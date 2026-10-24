import { AgentLoop, defineLoopTool } from '@civilization/agent-loop';
import { z } from 'zod';

/**
 * ModelCoreToLoopAdapter
 * 将 @civilization/model-core 的 BaseChatModel 桥接为 @civilization/agent-loop 所需的 ILoopChatModel
 */
export class ModelCoreToLoopAdapter {
  constructor(modelCoreInstance) {
    this.model = modelCoreInstance;
  }

  async invoke({ messages, tools, signal, temperature, maxTokens }) {
    const formattedTools = tools?.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters || {}
    }));

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

    const formattedTools = tools?.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters || {}
    }));

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
        return {
          status: 'success',
          action: 'append_to_board',
          targetElementId: targetId,
          linesAppended: latexLines.length
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
        return {
          status: 'success',
          action: 'created_new_board',
          elementId: newId,
          linesCount: latexLines.length
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
          return { status: 'success', action: 'appended_plot', axesId: existingAxes.id, expr };
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
          return { status: 'success', action: 'created_axes_and_plot', axesId: newAxesId, expr };
        }
      }

      if (category === 'geometry_3d') {
        canvasActions.push({
          type: 'axes3d',
          xLabel: 'x',
          yLabel: 'y',
          zLabel: 'z',
          color: '#334155'
        });
        if (shapeType) {
          canvasActions.push({
            type: 'shape3d',
            shapeType,
            plane: plane || 'xy',
            labels: labels || [],
            color: color || '#1d4ed8'
          });
        }
        return { status: 'success', action: 'created_3d_geometry', plane: plane || 'xy', shapeType };
      }

      // 2D 几何图形
      canvasActions.push({
        type: 'shape',
        shapeType: shapeType || 'triangle',
        labels: labels || ['A', 'B', 'C'],
        color: color || '#047857'
      });
      return { status: 'success', action: 'created_2d_shape', shapeType };
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
        return { status: 'success', action: 'substituted_equation', sourceEq, targetEq };
      }

      if (operation === 'replace_content' && replaceContent) {
        canvasActions.push({
          type: 'update_element',
          targetElementId,
          operation: 'replace',
          content: replaceContent
        });
        return { status: 'success', action: 'replaced_content' };
      }

      if (operation === 'resize') {
        canvasActions.push({
          type: 'update_element',
          targetElementId,
          scale: scale || 1.0,
          width: width || 520
        });
        return { status: 'success', action: 'resized_element', scale, width };
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
        return { status: 'success', action: 'deleted_element', targetElementId };
      }
      if (scope === 'all_board') {
        canvasActions.push({
          type: 'clear_board'
        });
        return { status: 'success', action: 'cleared_all_board' };
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
      maxIterations: 8,
      maxRepeatedCalls: 2,
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
3. 优雅的总结回复：
   - 工具调用完成后，请用简短规范的 Markdown 向考生汇报操作结果或关键结论（可包含 KaTeX 数学公式）。

【当前题目背景】:
${contextProblem ? contextProblem : '（无特定题目题干）'}`;

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  if (Array.isArray(recentConversation) && recentConversation.length > 0) {
    for (const msg of recentConversation.slice(-6)) {
      if (msg && typeof msg.content === 'string') {
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
  let estimatedInputTokens = Math.ceil((systemPrompt.length + spokenText.length + JSON.stringify(currentElements).length) / 2);
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

      if (event.type === 'text-delta' || event.type === 'reasoning-delta') {
        const deltaLen = (event.delta || '').length;
        accumulatedOutputTokens += Math.max(1, Math.ceil(deltaLen / 2));
      }

      const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
      const tokenSpeed = Number((accumulatedOutputTokens / elapsedSec).toFixed(1));
      const totalTokens = estimatedInputTokens + accumulatedOutputTokens;

      const metrics = {
        iteration: currentIteration,
        maxIterations: 8,
        inputTokens: estimatedInputTokens,
        outputTokens: accumulatedOutputTokens,
        totalTokens,
        tokenSpeed,
        contextTokens: estimatedInputTokens,
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
      maxIterations: 8,
      inputTokens: estimatedInputTokens,
      outputTokens: accumulatedOutputTokens,
      totalTokens: estimatedInputTokens + accumulatedOutputTokens,
      tokenSpeed: Number((accumulatedOutputTokens / elapsedSec).toFixed(1)),
      contextTokens: estimatedInputTokens,
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
            inputTokens: estimatedInputTokens,
            outputTokens: accumulatedOutputTokens,
            totalTokens: estimatedInputTokens + accumulatedOutputTokens,
            tokenSpeed: 0,
            contextTokens: estimatedInputTokens,
            maxContextTokens
          }
        });
      }
      return { success: false, aborted: true, canvasActions };
    }
    throw err;
  }
}
