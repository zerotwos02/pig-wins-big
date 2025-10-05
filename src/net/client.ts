// src/net/client.ts
import { toView, ViewSpin } from './adapters';
import { mockSpin } from './mock-server'; // returns proto SpinResponse

export async function spin(stake: number): Promise<ViewSpin> {
  const pb = await mockSpin(stake);
  return toView(pb);
}
