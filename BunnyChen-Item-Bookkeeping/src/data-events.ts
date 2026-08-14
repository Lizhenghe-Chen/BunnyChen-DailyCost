// ── 统一数据变更事件系统 ──────────────────────────────
// 任何 CRUD/导入/归档操作后统一调用 notifyDataChanged()
// 各模块通过 onDataChange() 注册自己的刷新逻辑
// 如需排查刷新遗漏：打开下面日志注释即可追踪每次调用

type DataChangeHandler = () => void;

const _handlers = new Set<DataChangeHandler>();

/** 注册数据变更监听器（自动去重） */
export function onDataChange(handler: DataChangeHandler): void {
  _handlers.add(handler);
}

/** 注销监听器 */
export function offDataChange(handler: DataChangeHandler): void {
  _handlers.delete(handler);
}

/** 通知所有监听器：数据已变更，请刷新 */
export function notifyDataChanged(): void {
  // 调试用：打开下面日志可以追踪每次数据变更触发
  // console.log(`[DataEvents] notifyDataChanged  handlers: ${_handlers.size}`);
  _handlers.forEach(fn => {
    try {
      fn();
    } catch (e) {
      console.error('[DataEvents] handler error:', e);
    }
  });
}
