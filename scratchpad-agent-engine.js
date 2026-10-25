import { AgentLoop, defineLoopTool } from '@civilization/agent-loop';
import { z } from 'zod';

function formatToolsForModelCore(tools) {
  if (!tools || !tools.length) return undefined;
  return tools.map((t) => {
    let rawParams = t.definition?.parameters || t.parameters;
    if (rawParams && rawParams.definitions && rawParams.$ref) {
      const defKey = rawParams.$ref.replace('#/definitions/', '');
      if (rawParams.definitions[defKey]) {
        rawParams = rawParams.definitions[defKey];
      }
    }
    const safeParams = {
      type: 'object',
      properties: (rawParams && typeof rawParams === 'object' && rawParams.properties) ? rawParams.properties : {},
      ...(rawParams?.required ? { required: rawParams.required } : {})
    };
    return {
      name: t.name,
      description: t.description || '',
      parameters: safeParams
    };
  });
}

/**
 * ModelCoreToLoopAdapter
 * 将 @civilization/model-core 的 BaseChatModel 桥接为 @civilization/agent-loop 所需的 ILoopChatModel
 */
export class ModelCoreToLoopAdapter {
  constructor(modelCoreInstance) {
    this.model = modelCoreInstance;
  }

  async invoke({ messages, tools, signal, temperature, maxTokens }) {
    const formattedTools = formatToolsForModelCore(tools);

    const unifiedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content || '',
      ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
      ...(m.toolCalls ? { toolCalls: m.toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: typeof tc.arguments === 'string' ? JSON.parse(tc.arguments || '{}') : (tc.arguments || {})
      })) } : {})
    }));

    const response = await this.model.invoke(unifiedMessages, {
      tools: formattedTools,
      signal,
      temperature,
      maxTokens
    });

    return {
      content: response.content || '',
      role: 'assistant',
      reasoningContent: response.reasoning || '',
      finishReason: response.stopReason || 'stop',
      toolCalls: response.toolCalls?.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments || {}
      })),
      usage: response.usage ? {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens
      } : undefined
    };
  }

  async *stream({ messages, tools, signal, temperature, maxTokens }) {
    if (typeof this.model.stream !== 'function') {
      const res = await this.invoke({ messages, tools, signal, temperature, maxTokens });
      yield {
        content: res.content,
        reasoningContent: res.reasoningContent,
        toolCallDeltas: res.toolCalls?.map((tc, index) => ({
          index,
          id: tc.id,
          name: tc.name,
          arguments: JSON.stringify(tc.arguments)
        }))
      };
      return;
    }

    const formattedTools = formatToolsForModelCore(tools);

    const unifiedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content || '',
      ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
      ...(m.toolCalls ? { toolCalls: m.toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: typeof tc.arguments === 'string' ? JSON.parse(tc.arguments || '{}') : (tc.arguments || {})
      })) } : {})
    }));

    const chunkStream = this.model.stream(unifiedMessages, {
      tools: formattedTools,
      signal,
      temperature,
      maxTokens
    });

    for await (const chunk of chunkStream) {
      yield {
        content: chunk.deltaContent || '',
        reasoningContent: chunk.deltaReasoning || '',
        toolCallDeltas: chunk.deltaToolCalls?.map((tc, index) => ({
          index: typeof tc.index === 'number' ? tc.index : index,
          id: tc.id,
          name: tc.name,
          arguments: typeof tc.arguments === 'string' ? tc.arguments : (tc.arguments ? JSON.stringify(tc.arguments) : '')
        })),
        finishReason: chunk.stopReason
      };
    }
  }
}

/**
 * 创建草稿纸 Agent 工具集
 */
export function createScratchpadTools({ currentElements, canvasActions, onToolEvent }) {
  // 记录本轮已执行操作的指纹，实现工具级幂等守卫与快速引导
  const executedSignatures = new Set();

  // 1. read_scratchpad: 查阅画板
  const readScratchpad = defineLoopTool({
    name: 'read_scratchpad',
    description: '查阅考生当前草稿板上的所有板书图元、公式推导步骤与几何图形列表。在做修改、代换或删除前应先读板。',
    schema: z.object({
      elementId: z.string().optional().describe('可选指定图元ID，留空返回全板概览')
    }),
    execute: ({ elementId }) => {
      if (elementId) {
        const found = currentElements.find((e) => e.id === elementId);
        if (!found) return { error: `未找到 ID 为 ${elementId} 的图元` };
        return { element: found };
      }
      return {
        totalElements: currentElements.length,
        elements: currentElements.map((e) => ({
          id: e.id,
          title: e.title,
          conclusion: e.conclusion,
          width: e.width,
          height: e.height,
          actions: (e.actions || []).map((a) => ({
            type: a.type,
            content: a.content,
            label: a.label,
            expr: a.expr,
            shapeType: a.shapeType
          }))
        }))
      };
    }
  });

  // 2. write_math_derivation: 誊写/追加数学板书
  const writeMath = defineLoopTool({
    name: 'write_math_derivation',
    description: '在草稿纸上呈现规范的数学演算与推导步骤（以分步 LaTeX 呈现）。支持誊写考生口述算式，或根据草稿纸已有公式/题干已知条件执行代入代换、合并化简与规范板书记录。严禁在考生未提供公式时主动凭空提供未见外部定理。单次 1~4 行。',
    schema: z.object({
      latexLines: z.array(z.string()).max(4).describe('规范的LaTeX推导行列表，单次 1~4 行，如题干公式代入或展开整理步骤，如 ["\\\\lim_{x \\\\to 0} \\\\frac{ax^2+bx+(x+\\\\frac{1}{6}x^3)}{\\\\frac{1}{3}x^2} = 1"]') ,
      title: z.string().optional().describe('贴切具体的板书卡片小标题，如 "📝 题干公式代入替换"'),
      targetElementId: z.string().optional().describe('追加的目标板书图元ID，不传则自动维护现有主板书'),
      conclusion: z.string().optional().describe('当前推导的核心结论公式，用于折叠时展示')
    }),
    execute: ({ latexLines, title, targetElementId, conclusion }) => {
      // 截断保护：确保不超过 4 行
      const safeLines = (latexLines || []).slice(0, 4);
      const formattedContent = safeLines.join('\n');
      const sigKey = `write:${formattedContent.trim()}`;
      if (executedSignatures.has(sigKey)) {
        return {
          status: 'already_completed',
          action: 'none',
          message: '⚠️ 该数学板书已在上一轮成功写入草稿纸前端画布，无需重复执行。当前画板已包含该内容。请严禁再次调用写入工具，必须立即直接向考生输出规范友好的 Markdown 总结与答复，结束本轮对话。'
        };
      }
      executedSignatures.add(sigKey);

      const existingWrite = currentElements.find((e) => (e.actions || []).some((a) => a.type === 'write'));

      if (targetElementId || existingWrite) {
        const targetId = targetElementId || existingWrite.id;
        const actionId = `act_update_${targetId}_${Date.now()}`;
        canvasActions.push({
          actionId,
          type: 'update_element',
          targetElementId: targetId,
          operation: 'append',
          content: formattedContent,
          title,
          conclusion
        });

        // 内存同步更新
        const targetElem = currentElements.find((e) => e.id === targetId);
        if (targetElem) {
          if (!targetElem.actions) targetElem.actions = [];
          targetElem.actions.push({
            type: 'write',
            content: formattedContent,
            title,
            conclusion
          });
          if (title) targetElem.title = title;
          if (conclusion) targetElem.conclusion = conclusion;
        }

        return {
          status: 'success',
          action: 'append_to_board',
          targetElementId: targetId,
          linesAppended: safeLines.length,
          instruction: '✅ 板书已成功追加到草稿纸画布！前端已实时渲染展示。请严禁再次调用写入工具，请立即向考生输出简明规范的 Markdown 文本答复与总结，结束本轮对话。'
        };
      } else {
        const newId = `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const actionId = `act_create_${newId}`;
        canvasActions.push({
          id: newId,
          actionId,
          type: 'write',
          content: formattedContent,
          title: title || '📝 规范推导板书',
          conclusion,
          color: '#0f172a'
        });

        // 内存同步更新
        currentElements.push({
          id: newId,
          title: title || '📝 规范推导板书',
          conclusion,
          actions: [{
            type: 'write',
            content: formattedContent,
            title: title || '📝 规范推导板书',
            conclusion,
            color: '#0f172a'
          }]
        });

        return {
          status: 'success',
          action: 'created_new_board',
          elementId: newId,
          linesCount: safeLines.length,
          instruction: '✅ 板书已成功创建并规范呈现于草稿纸画布！前端已实时渲染展示。请严禁再次调用写入工具，请立即向考生输出简明规范的 Markdown 文本答复与总结，结束本轮对话。'
        };
      }
    }
  });

  // 3. draw_geometry_or_plot: 绘制几何与函数曲线
  const drawPlot = defineLoopTool({
    name: 'draw_geometry_or_plot',
    description: '在画图区绘制函数曲线、直角坐标系、三维坐标系或平面几何图形。',
    schema: z.object({
      category: z.enum(['function_plot', 'geometry_2d', 'geometry_3d']).describe('图形分类'),
      expr: z.string().optional().describe('函数表达式，如 "sin(x)", "x^2", "cos(x)"'),
      shapeType: z.string().optional().describe('几何图形类型，如 circle, triangle, right_triangle, square'),
      plane: z.enum(['xy', 'xz', 'yz']).optional().describe('三维坐标系下的投影平面，默认 xy'),
      labels: z.array(z.string()).optional().describe('顶点或标记字母列表，如 ["A", "B", "C"]'),
      color: z.string().optional().describe('绘制颜色 Hex'),
      targetAxesId: z.string().optional().describe('指定叠加的已有坐标系ID，留空自动决策')
    }),
    execute: ({ category, expr, shapeType, plane, labels, color, targetAxesId }) => {
      const sigKey = `draw:${category}:${expr || ''}:${shapeType || ''}:${plane || ''}`;
      if (executedSignatures.has(sigKey)) {
        return {
          status: 'already_completed',
          action: 'none',
          message: '⚠️ 该图形或曲线已在上一轮成功绘制在草稿纸上。请严禁再次调用绘图工具，必须立即直接向考生输出自然语言文本说明与总结，结束本轮对话。'
        };
      }
      executedSignatures.add(sigKey);

      if (category === 'function_plot' && expr) {
        const existingAxes = targetAxesId
          ? currentElements.find((e) => e.id === targetAxesId)
          : currentElements.find((e) => (e.actions || []).some((a) => a.type === 'axes'));

        if (existingAxes) {
          canvasActions.push({
            type: 'update_element',
            targetElementId: existingAxes.id,
            operation: 'append',
            actions: [{ type: 'plot', expr, label: `y = ${expr}`, color: color || '#1d4ed8' }]
          });
          if (!existingAxes.actions) existingAxes.actions = [];
          existingAxes.actions.push({ type: 'plot', expr, label: `y = ${expr}`, color: color || '#1d4ed8' });

          return {
            status: 'success',
            action: 'appended_plot',
            axesId: existingAxes.id,
            expr,
            instruction: '✅ 函数曲线已成功追加绘制至现有坐标系！前端已实时渲染展示。请严禁再次调用绘图工具，请立即向考生输出分析总结答复。'
          };
        } else {
          const newAxesId = `axes_${Date.now()}`;
          canvasActions.push({
            type: 'axes',
            id: newAxesId,
            xLabel: 'x',
            yLabel: 'y'
          });
          canvasActions.push({
            type: 'plot',
            expr,
            label: `y = ${expr}`,
            color: color || '#1d4ed8'
          });

          currentElements.push({
            id: newAxesId,
            title: `📊 函数图像: y = ${expr}`,
            actions: [
              { type: 'axes', id: newAxesId, xLabel: 'x', yLabel: 'y' },
              { type: 'plot', expr, label: `y = ${expr}`, color: color || '#1d4ed8' }
            ]
          });

          return {
            status: 'success',
            action: 'created_axes_and_plot',
            axesId: newAxesId,
            expr,
            instruction: '✅ 坐标系与函数图像已成功绘制！前端已实时渲染展示。请严禁再次调用绘图工具，请立即向考生输出分析总结答复。'
          };
        }
      }

      if (category === 'geometry_3d') {
        const geom3dId = `geom3d_${Date.now()}`;
        canvasActions.push({
          type: 'axes3d',
          id: geom3dId,
          xLabel: 'x',
          yLabel: 'y',
          zLabel: 'z',
          color: '#334155'
        });
        const actions = [{ type: 'axes3d', id: geom3dId, xLabel: 'x', yLabel: 'y', zLabel: 'z', color: '#334155' }];
        if (shapeType) {
          canvasActions.push({
            type: 'shape3d',
            shapeType,
            plane: plane || 'xy',
            labels: labels || [],
            color: color || '#1d4ed8'
          });
          actions.push({
            type: 'shape3d',
            shapeType,
            plane: plane || 'xy',
            labels: labels || [],
            color: color || '#1d4ed8'
          });
        }

        currentElements.push({
          id: geom3dId,
          title: `📐 三维几何: ${shapeType || '立体空间'}`,
          actions
        });

        return {
          status: 'success',
          action: 'created_3d_geometry',
          plane: plane || 'xy',
          shapeType,
          instruction: '✅ 三维几何图形已成功生成并绘制在草稿纸上！前端已实时渲染展示。请严禁再次调用绘图工具，请立即向考生输出分析说明。'
        };
      }

      // 2D 几何图形
      const geom2dId = `geom2d_${Date.now()}`;
      canvasActions.push({
        type: 'shape',
        id: geom2dId,
        shapeType: shapeType || 'triangle',
        labels: labels || ['A', 'B', 'C'],
        color: color || '#047857'
      });
      currentElements.push({
        id: geom2dId,
        title: `📐 平面几何: ${shapeType || '几何图形'}`,
        actions: [{
          type: 'shape',
          id: geom2dId,
          shapeType: shapeType || 'triangle',
          labels: labels || ['A', 'B', 'C'],
          color: color || '#047857'
        }]
      });

      return {
        status: 'success',
        action: 'created_2d_shape',
        shapeType,
        instruction: '✅ 平面几何图形已成功绘制在草稿纸上！前端已实时渲染展示。请严禁再次调用绘图工具，请立即向考生输出分析说明。'
      };
    }
  });

  // 4. update_or_substitute: 等量代换与就地修改
  const updateSubstitute = defineLoopTool({
    name: 'update_or_substitute',
    description: '对草稿板上已有的推导步骤执行等量代换、笔误修正、或调整卡片字号缩放比例。',
    schema: z.object({
      targetElementId: z.string().describe('要操作的目标板书图元ID'),
      operation: z.enum(['substitute', 'replace_content', 'resize']).describe('操作类型'),
      sourceEq: z.string().optional().describe('代换源符号/等式，如 "\\cos y"'),
      targetEq: z.string().optional().describe('代入目标表达式，如 "\\sqrt{1-x^2}"'),
      replaceContent: z.string().optional().describe('replace_content操作下的完整新板书内容'),
      scale: z.number().optional().describe('字号缩放比例 (0.8~1.5)'),
      width: z.number().optional().describe('板书卡片宽度 (480~720)')
    }),
    execute: ({ targetElementId, operation, sourceEq, targetEq, replaceContent, scale, width }) => {
      const el = currentElements.find((e) => e.id === targetElementId);
      if (!el) return { error: `未找到 ID 为 ${targetElementId} 的图元` };

      if (operation === 'substitute' && sourceEq && targetEq) {
        const step = `$\\because ${sourceEq} = ${targetEq} \\implies 代入得：$`;
        canvasActions.push({
          type: 'update_element',
          targetElementId,
          operation: 'append',
          content: step
        });
        if (!el.actions) el.actions = [];
        el.actions.push({ type: 'write', content: step });

        return {
          status: 'success',
          action: 'substituted_equation',
          sourceEq,
          targetEq,
          instruction: '✅ 等量代换步骤已成功追加至板书！前端已实时渲染。请严禁重复调用，请立即输出文本答复总结。'
        };
      }

      if (operation === 'replace_content' && replaceContent) {
        canvasActions.push({
          type: 'update_element',
          targetElementId,
          operation: 'replace',
          content: replaceContent
        });
        el.actions = [{ type: 'write', content: replaceContent }];

        return {
          status: 'success',
          action: 'replaced_content',
          instruction: '✅ 板书内容已成功就地替换修正！前端已实时渲染。请严禁重复调用，请立即输出文本答复总结。'
        };
      }

      if (operation === 'resize') {
        canvasActions.push({
          type: 'update_element',
          targetElementId,
          scale: scale || 1.0,
          width: width || 520
        });
        el.scale = scale || 1.0;
        el.width = width || 520;

        return {
          status: 'success',
          action: 'resized_element',
          scale,
          width,
          instruction: '✅ 板书卡片尺寸已成功调整！前端已实时渲染。请严禁重复调用，请立即输出文本答复总结。'
        };
      }

      return { status: 'noop' };
    }
  });

  // 5. delete_or_clear: 擦除与清空
  const deleteOrClear = defineLoopTool({
    name: 'delete_or_clear',
    description: '删除指定板书/图形图元，或一键清空草稿纸全部内容。',
    schema: z.object({
      scope: z.enum(['single_element', 'all_board']).describe('删除范围'),
      targetElementId: z.string().optional().describe('当 scope 为 single_element 时的目标图元ID')
    }),
    execute: ({ scope, targetElementId }) => {
      if (scope === 'single_element' && targetElementId) {
        canvasActions.push({
          type: 'delete_element',
          targetElementId
        });
        const idx = currentElements.findIndex((e) => e.id === targetElementId);
        if (idx !== -1) currentElements.splice(idx, 1);

        return {
          status: 'success',
          action: 'deleted_element',
          targetElementId,
          instruction: '✅ 目标图元已从草稿纸擦除！前端已实时更新。请严禁重复调用，请立即向考生输出答复。'
        };
      }
      if (scope === 'all_board') {
        canvasActions.push({
          type: 'clear_board'
        });
        currentElements.length = 0;

        return {
          status: 'success',
          action: 'cleared_all_board',
          instruction: '✅ 草稿纸画板已全部清空！前端已实时更新。请严禁重复调用，请立即向考生输出答复。'
        };
      }
      return { status: 'noop' };
    }
  });

  // 6. fill_exam_answer: 自动回填试卷答题区 (全题型支持：选择、填空、判断、主观题)
  const fillExamAnswer = defineLoopTool({
    name: 'fill_exam_answer',
    description: '将推导结论或考生指定的答案直接填入当前题目的试卷答题区（支持全题型：单选、多选、填空、判断、主观解答题）。当考生说“选A”、“选B”、“填入 1/6”、“答案正确”、“把结论填到答题卡/试卷”时调用。',
    schema: z.object({
      answer: z.string().describe('填入的具体答案内容。单选/多选题填选项字母如 "A"、"CD"；填空题填具体数值、公式或表达式如 "1/6"、"\\\\sqrt{2}"、"e^x"；判断题填 "正确"/"错误"；主观大题填最终计算结论或规范分步解答'),
      questionType: z.enum(['choice', 'fill_blank', 'true_false', 'subjective']).optional().describe('当前题目所属题型'),
      reason: z.string().optional().describe('回填依据或简要结论说明，如 "经麦克劳林展开求导得 a=1/3, b=-1"')
    }),
    execute: ({ answer, questionType, reason }) => {
      const cleanAns = String(answer || '').trim();
      canvasActions.push({
        type: 'fill_answer',
        answer: cleanAns,
        questionType,
        reason
      });
      return {
        status: 'success',
        action: 'filled_exam_answer',
        answer: cleanAns,
        instruction: `✅ 答案【${cleanAns}】已成功自动填入试卷答题区！前端已实时同步答题卡并高亮显示。请立即向考生输出简明答复告知已帮其填入。`
      };
    }
  });

  return [readScratchpad, writeMath, drawPlot, updateSubstitute, deleteOrClear, fillExamAnswer];
}

/**
 * 运行真 Agent Loop 流式任务
 */
export async function runScratchpadAgentLoopStream({
  modelInstance,
  spokenText,
  contextProblem = '',
  currentBoardElements = [],
  recentConversation = [],
  assistantTone = 'supportive',
  mode = 'exam_scratchpad', // 模式区分：'exam_scratchpad' (考场草稿辅助·严格防作弊) | 'notebook_tutor' (错题本/解析助教·课后研学)
  maxContextTokens = 131072,
  onEvent,
  signal
}) {
  const canvasActions = [];
  const currentElements = Array.isArray(currentBoardElements) ? [...currentBoardElements] : [];

  const tools = createScratchpadTools({ currentElements, canvasActions });
  const modelAdapter = new ModelCoreToLoopAdapter(modelInstance);

  const loop = new AgentLoop({
    model: modelAdapter,
    tools,
    config: {
      maxIterations: 6,
      maxRepeatedCalls: 3,
      maxRepairAttempts: 2
    }
  });

  const isExamMode = mode === 'exam_scratchpad';

  const systemPrompt = isExamMode
    ? `你是一名敏捷、智能且富有数理素养的考场草稿助手（Exam Scratchpad Assistant）。
当前处于考场草稿演练场景，你扮演考生的智能草稿纸书写板、代数演算与几何画图员。

【核心防作弊底线（只需保证不主动透露外部公式）】：
1. 唯一防作弊红线：
   - 严禁在考生未口述且题干未给出的情况下，主动向考生提供外部数学定理、公式展开或直接代做题目（例如考生直接提问“arcsin x 的展开公式是什么？”、“写出麦克劳林展开式给我看”、“这道题最终答案是几”）。
   - 遇到此类直接索取未知公式的提问，仅需简明温和提示 1 句：“🛡️【考场提示】：请自行回忆该公式，您在草稿纸写下或口述后，我立刻为您进行代换与排版演算。”，严禁长篇大论说教或多条指责。
2. 积极协助代换、化简与排版演算（完全合规且必须积极执行）：
   - 只要草稿纸上已经存在考生写下的公式（或题干中已有已知式），当考生要求“把题干公式用我们已知公式替换”、“把第一行代入分子/分母”、“化简式子”、“合并同类项”等，你必须积极、聪明地协助考生完成代换，调用 write_math_derivation 或 update_or_substitute 将代换整理后的推导步骤清晰呈现在草稿板上！
   - 绝不要死板教条地要求考生把代换后的每个字符都一字不漏地念出来。草稿助手就是要替考生完成代换排版、式子整理与几何画图！
3. 协助考生全题型自动回填试卷答案（极速答题赋能）：
   - 无论单选、多选、填空、判断还是主观解答题，当考生口述答案或指示填入试卷答题卡时，必须调用 fill_exam_answer 工具直接回填到试卷答题区：
     * 【单选/多选题】：考生说“选A”、“选B”、“多选选ACD”、“选第一个”等，回填对应选项字母（如 "A"、"CD"）；
     * 【填空题】：考生说“填空填 1/6”、“答案是根号3”、“空里填 e^x”、“把结果填入”，回填具体数值、表达式或 LaTeX 规范串（如 "1/6"、"\\sqrt{3}"、"e^x"）；
     * 【判断题】：考生说“选正确”、“填错误”、“这道题是对的”，回填 "正确" / "错误" 或对应标识；
     * 【主观计算/证明大题】：考生说“把答案/结论填入试卷”、“将草稿过程誊写到答卷”，将核心计算结论或规范分步推导填入答题区；
   - 并在文本答复中告知考生已成功填入：“✅ 已为您将答案【{填入的答案内容}】填入试卷答题区！”
4. 常用工具调用指南：
   - fill_exam_answer: 自动回填试卷答案（支持单选/多选/填空/判断/大题结论）；
   - write_math_derivation: 在草稿纸上呈现规范的 LaTeX 演算或代换步骤（1~4 行），如题干公式代入、展开式代换；
   - draw_geometry_or_plot: 绘制几何图形或函数曲线；
   - update_or_substitute: 进行就地等量代换或板书局部调整；
   - read_scratchpad: 查阅草稿板当前内容。
5. 回复简短利落：
   - 执行操作后，直接以 1~2 句简明的中文 Markdown 告知考生已完成的代换、板书或答案回填，结束本轮对话。
`
    : `你是一名博学、亲切且深入浅出的全能数学名师助教（Post-Exam Notebook Tutor）。
当前处于【考试结束后的错题本复盘与深度研学阶段】！
考生已经完成交卷，你拥有完全放开的解题、推导、答疑与拓展权限：
1. 深入剖析题干考点，给出完整的证明与推导过程（如泰勒展开式的完整求导、二项式展开与逐项积分全流程推导）；
2. 剖析失分陷阱，解释易错点与等价无穷小代换的适用前提；
3. 协助考生将关键推导板书落到草稿纸上，并提炼举一反三的变式解法；
4. 鼓励考生反思总结，助力彻底攻克该类题型！

`;

  const fullSystemPrompt = `${systemPrompt}

【当前题目背景】:
${contextProblem ? contextProblem : '（无特定题目题干）'}`;

  const messages = [
    { role: 'system', content: fullSystemPrompt }
  ];

  let conversationChars = 0;
  if (Array.isArray(recentConversation) && recentConversation.length > 0) {
    for (const msg of recentConversation.slice(-6)) {
      if (msg && typeof msg.content === 'string') {
        conversationChars += msg.content.length;
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }
  }

  messages.push({
    role: 'user',
    content: spokenText
  });

  const startTime = Date.now();
  let accumulatedOutputTokens = 0;
  let toolCallsCount = 0;
  // 综合估算输入 Tokens（系统提示词 + 题目背景 + 画板元素 + 历史对话 + 用户输入 + 工具描述）
  const estimatedInputTokens = Math.max(
    1,
    Math.ceil(
      ((systemPrompt || '').length +
        (spokenText || '').length +
        conversationChars +
        JSON.stringify(currentElements).length +
        1200) / 2
    )
  );
  let currentIteration = 1;

  try {
    const generator = loop.runStream({
      messages,
      signal
    });

    for await (const event of generator) {
      if (signal?.aborted) break;

      if (event.type === 'iteration-start') {
        currentIteration = event.iteration;
      }

      if (event.type === 'tool-result') {
        toolCallsCount++;
      }

      if (event.type === 'text-delta' || event.type === 'reasoning-delta') {
        const deltaLen = (event.delta || '').length;
        accumulatedOutputTokens += Math.max(1, Math.ceil(deltaLen / 2));
      }

      const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
      const tokenSpeed = Number((accumulatedOutputTokens / elapsedSec).toFixed(1));
      const totalTokens = estimatedInputTokens + accumulatedOutputTokens;

      const metrics = {
        iteration: currentIteration,
        toolCallsCount,
        inputTokens: estimatedInputTokens,
        outputTokens: accumulatedOutputTokens,
        totalTokens,
        tokenSpeed,
        contextTokens: totalTokens,
        maxContextTokens
      };

      if (onEvent) {
        let safeEvent = event;
        if (event.type === 'error') {
          safeEvent = {
            ...event,
            error: event.error instanceof Error ? event.error.message : String(event.error || '模型异常')
          };
        }

        // 斩断流式风暴：纯流式文字（text-delta 与 reasoning-delta）绝不重复全量携带 canvasActions！
        // 只有当工具执行产生实质画板变动（tool-result）或者循环完成（completed）时才下发 canvasActions
        const shouldIncludeCanvasActions = event.type === 'tool-result' || event.type === 'completed';

        onEvent({
          ...safeEvent,
          metrics,
          ...(shouldIncludeCanvasActions && canvasActions.length > 0 ? { canvasActions: [...canvasActions] } : {})
        });
      }
    }

    const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
    const finalMetrics = {
      iteration: currentIteration,
      toolCallsCount,
      inputTokens: estimatedInputTokens,
      outputTokens: accumulatedOutputTokens,
      totalTokens: estimatedInputTokens + accumulatedOutputTokens,
      tokenSpeed: Number((accumulatedOutputTokens / elapsedSec).toFixed(1)),
      contextTokens: estimatedInputTokens + accumulatedOutputTokens,
      maxContextTokens,
      elapsedTime: Number(elapsedSec.toFixed(2))
    };

    return {
      success: true,
      canvasActions,
      metrics: finalMetrics
    };
  } catch (err) {
    if (signal?.aborted || err.name === 'AbortError' || err.message?.includes('aborted')) {
      if (onEvent) {
        onEvent({
          type: 'aborted',
          metrics: {
            iteration: currentIteration,
            toolCallsCount,
            inputTokens: estimatedInputTokens,
            outputTokens: accumulatedOutputTokens,
            totalTokens: estimatedInputTokens + accumulatedOutputTokens,
            tokenSpeed: 0,
            contextTokens: estimatedInputTokens + accumulatedOutputTokens,
            maxContextTokens
          }
        });
      }
      return { success: false, aborted: true, canvasActions };
    }

    // 针对死循环熔断或超轮次熔断的自愈降级处理
    if (
      err.name === 'LoopInfiniteLoopError' ||
      err.name === 'LoopMaxIterationsError' ||
      err.message?.includes('Infinite loop detected') ||
      err.message?.includes('maximum allowed iterations')
    ) {
      console.warn(`[scratchpad-agent-engine] 触发循环防护熔断 (${err.name}):`, err.message);
      console.log(`[scratchpad-agent-engine] 自动转为优雅收敛完成 (已有 ${canvasActions.length} 项有效画板操作)。`);
      
      const fallbackText = canvasActions.length > 0
        ? '\n\n✅ 板书推导与图形已规范记录至草稿纸。请继续下一步思路。'
        : '\n\n已完成思路梳理。需要我把哪一步具体推导公式或图形落到草稿纸上吗？请随时告诉我。';

      if (onEvent) {
        onEvent({
          type: 'text-delta',
          delta: fallbackText
        });
        onEvent({
          type: 'completed',
          metrics: {
            iteration: currentIteration,
            toolCallsCount,
            maxIterations: 6,
            inputTokens: estimatedInputTokens,
            outputTokens: accumulatedOutputTokens + 20,
            totalTokens: estimatedInputTokens + accumulatedOutputTokens + 20,
            tokenSpeed: 0,
            contextTokens: estimatedInputTokens + accumulatedOutputTokens + 20,
            maxContextTokens
          },
          canvasActions: [...canvasActions]
        });
      }
      return {
        success: true,
        canvasActions,
        metrics: {
          iteration: currentIteration,
          toolCallsCount,
          inputTokens: estimatedInputTokens,
          outputTokens: accumulatedOutputTokens + 20,
          totalTokens: estimatedInputTokens + accumulatedOutputTokens + 20,
          tokenSpeed: 0,
          contextTokens: estimatedInputTokens + accumulatedOutputTokens + 20,
          maxContextTokens
        }
      };
    }

    throw err;
  }
}
