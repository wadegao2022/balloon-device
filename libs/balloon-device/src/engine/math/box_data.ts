const npn = [-1, 1, -1];
const npp = [-1, 1, 1];
const ppp = [1, 1, 1];
const ppn = [1, 1, -1];
const nnn = [-1, -1, -1];
const nnp = [-1, -1, 1];
const pnp = [1, -1, 1];
const pnn = [1, -1, -1];

export class BoundingBoxData {
  static readonly ndcVertices = [npn, npp, ppp, ppn, nnn, nnp, pnp, pnn];
  static generateVertexData(v: number[][]): number[] {
    return [
      ...v[0],
      ...v[1],
      ...v[2],
      ...v[3],
      ...v[1],
      ...v[5],
      ...v[6],
      ...v[2],
      ...v[2],
      ...v[6],
      ...v[7],
      ...v[3],
      ...v[3],
      ...v[7],
      ...v[4],
      ...v[0],
      ...v[0],
      ...v[4],
      ...v[5],
      ...v[1],
      ...v[5],
      ...v[4],
      ...v[7],
      ...v[6],
    ];
  }
  static readonly ndcBoxVertices = new Float32Array([
    ...npn,
    ...npp,
    ...ppp,
    ...ppn,
    ...npp,
    ...nnp,
    ...pnp,
    ...ppp,
    ...ppp,
    ...pnp,
    ...pnn,
    ...ppn,
    ...ppn,
    ...pnn,
    ...nnn,
    ...npn,
    ...npn,
    ...nnn,
    ...nnp,
    ...npp,
    ...nnp,
    ...nnn,
    ...pnn,
    ...pnp,
  ]);
  static readonly boxBarycentric = new Float32Array([
    1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1,
    1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0,
    1, 0, 0, 1, 1, 0, 1, 0,
  ]);
  static readonly boxIndices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16,
    18, 19, 20, 21, 22, 20, 22, 23,
  ]);
}
