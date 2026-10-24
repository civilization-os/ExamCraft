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
          index,
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
    description: '在草稿板上规范誊写或追加数学推导步骤（以分步 LaTeX 呈现）。忠实呈现考生的推导脉络。',
    schema: z.object({
      latexLines: z.array(z.string()).describe('规范的LaTeX推导行列表，每步独立一行，如 ["\\\\because x = \\\\sin y", "\\\\therefore x\' = \\\\cos y \\\\cdot y\'"]'),
      title: z.string().optional().describe('贴切具体的板书卡片小标题，如 "📝 y = \\arcsin x 求导推演"'),
      targetElementId: z.string().optional().describe('追加的目标板书图元ID，不传则自动维护现有主板书'),
      conclusion: z.string().optional().describe('当前推导的核心结论公式，用于折叠时展示，如 "(\\arcsin x)\' = \\frac{1}{\\sqrt{1-x^2}}"')
    }),
    execute: ({ latexLines, title, targetElementId, conclusion }) => {
      const formattedContent = latexLines.join('\n');
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
        canvasActions.push({
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
          linesAppended: latexLines.length,
          instruction: '✅ 板书已成功追加到草稿纸画布！前端已实时渲染展示。请严禁再次调用写入工具，请立即向考生输出简明规范的 Markdown 文本答复与总结，结束本轮对话。'
        };
      } else {
        const newId = `elem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        canvasActions.push({
          type: 'write',
          id: newId,
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
          linesCount: latexLines.length,
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

  return [readScratchpad, writeMath, drawPlot, updateSubstitute, deleteOrClear];
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

  const systemPrompt = `你是一名严谨、专注且富有数学素养的考场草稿纸助教（Scratchpad Assistant）。
你的核心任务是协助考生在草稿纸上规范记录数学推导板书、绘制几何图形与函数曲线、执行等式代换与局部纠错。

【核心工作准则】：
1. 观察与行动优先 (Action via Tools)：
   - 考生的口述凡是涉及推导、写式子、代换、画图或擦除，**必须通过调用对应工具在画板上切实执行**。
   - 修改、代换或删除已有板书前，若不确定画板图元状态，先调用 \`read_scratchpad\` 查阅最新真实板书。
2. 帮写不帮算 (Assist, Never Cheat)：
   - 忠实、规范地将考生的口述思路整理为学术标准的 LaTeX 分步板书（每步一行，公式包裹在 $...$ 中）；
   - 严禁替考生做题、严禁主动算出考生未给出的未知结论或最终数值。
3. 工具单次生效与严禁重复调用（绝对铁律）：
   - 针对考生的每一句口述指令，写入或绘图工具只需且只能调用 1 次！
   - 一旦工具返回 status 为 'success' 或 'already_completed'，前端草稿纸画布就已经实时渲染生效，严禁使用相同或相似参数再次调用该工具！
   - 工具调用成功后，你的下一步必须是——直接输出规范精炼的 Markdown 文本答复向考生汇报与总结（可包含 KaTeX 数学公式），结束本轮对话。绝对不可继续调用工具！
4. 全程规范中文与专业输出（严禁暴露底层接口或内部调试）：
   - 思考过程与最终答复必须统一使用自然地道的中文，严禁使用英文内心独白或英文碎片；
   - 工具调用必须通过标准的 Function Calling 结构化接口提交，严禁在正文回答中伪造任何 XML 标签（如 <parameter>、<tool> 等）或裸 JSON 代码块；
   - 严禁向考生倾倒底层接口报错、参数序列化或重试等系统内部调试信息，始终保持沉着、专业、专注。

【当前题目背景】:
${contextProblem ? contextProblem : '（无特定题目题干）'}`;

  const messages = [
    { role: 'system', content: systemPrompt }
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
        onEvent({
          ...event,
          metrics,
          canvasActions: [...canvasActions]
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
          delta: fallbackText,
          canvasActions: [...canvasActions]
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
