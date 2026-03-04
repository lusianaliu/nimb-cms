export interface RuntimeAdapter {
  start(): Promise<void>
  stop(): Promise<void>
}
