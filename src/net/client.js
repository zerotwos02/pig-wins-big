// src/net/client.ts
import { toView } from './adapters';
import { mockSpin } from './mock-server'; // returns proto SpinResponse
export async function spin(stake) {
    const pb = await mockSpin(stake);
    return toView(pb);
}
