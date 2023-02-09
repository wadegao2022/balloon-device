function testShader(gl: WebGLRenderingContext | WebGL2RenderingContext, source: string, type: number) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.log(gl.getShaderInfoLog(shader));
  }
  gl.deleteShader(shader);
}

window.onload = function () {
  const cvs = document.querySelector<HTMLCanvasElement>('#canvas');
  const gl = cvs.getContext('webgl');
  const testVertexShader = `#version 100
  #extension GL_EXT_shader_texture_lod: enable
  precision highp float;
  attribute vec3 position;
  uniform highp sampler2D tex;
  void main() {
    gl_Position = texture2DLodEXT(tex, vec2(0.0, 0.0), 0.0);
  }
  `;
  testShader(gl, testVertexShader, gl.VERTEX_SHADER);
  const testFragmentShader = `#version 100
  precision highp float;
  uniform sampler2D samplers;
  void setE(out float x, int i, float val) {
    x = val;
  }
  void main() {
    const vec3 v = normalize(vec3(1, 1, 1));
    float arr[10];
    setE(arr[0], 0, 1.1);
    gl_FragColor = texture2D(samplers, vec2(arr[0]));
  }
  `;
  testShader(gl, testFragmentShader, gl.FRAGMENT_SHADER);
};
