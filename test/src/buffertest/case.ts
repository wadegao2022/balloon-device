import * as chaos from 'balloon-device';

export async function testBufferReadWrite(device: chaos.Device) {
  const readBuffer = device.createBuffer(4, chaos.GPUResourceUsageFlags.BF_READ);
  readBuffer.bufferSubData(0, new Uint8Array([1, 2, 3, 4]), 0, 4);
  const vertexBuffer = device.createStructuredBuffer(chaos.makeVertexBufferType(100, 'position_f32'), chaos.GPUResourceUsageFlags.BF_VERTEX | chaos.GPUResourceUsageFlags.MANAGED);
  const data = new Float32Array(100);
  vertexBuffer.bufferSubData(0, data, 0, 20);
  vertexBuffer.bufferSubData(160, data, 0, 20);
  vertexBuffer.bufferSubData(320, data, 0, 20);
  vertexBuffer.bufferSubData(80, data, 0, 20);
  vertexBuffer.bufferSubData(240, data, 0, 20);
  vertexBuffer.bufferSubData(120, data, 0, 30);
}
