import * as chaos from 'balloon-device';

(async function () {
  const viewer = new chaos.Viewer(document.getElementById('canvas') as HTMLCanvasElement);
  await viewer.initDevice('webgpu', { msaa: true });
  const guiRenderer = new chaos.GUIRenderer(viewer.device);
  const GUI = new chaos.GUI(guiRenderer);
  await GUI.deserializeFromXML(document.querySelector('#main-ui').innerHTML);
  const sceneView = GUI.document.querySelector('#scene-view');
  sceneView.customDraw = true;

  const pb = new chaos.ProgramBuilder(viewer.device);
  const spriteProgram = pb.buildRenderProgram({
    label: 'spriteRender',
    vertex() {
      this.$inputs.pos = pb.vec2().attrib('position');
      this.$inputs.instPos = pb.vec2().attrib('texCoord0');
      this.$inputs.instVel = pb.vec2().attrib('texCoord1');
      this.$mainFunc(function () {
        this.angle = pb.neg(pb.atan2(this.$inputs.instVel.x, this.$inputs.instVel.y));
        this.c = pb.cos(this.angle);
        this.s = pb.sin(this.angle);
        this.x = pb.sub(pb.mul(this.$inputs.pos.x, this.c), pb.mul(this.$inputs.pos.y, this.s));
        this.y = pb.add(pb.mul(this.$inputs.pos.x, this.s), pb.mul(this.$inputs.pos.y, this.c));
        this.$builtins.position = pb.vec4(pb.add(this.$inputs.instPos, pb.vec2(this.x, this.y)), 0, 1);
      });
    },
    fragment() {
      this.$outputs.color = pb.vec4();
      this.$mainFunc(function () {
        this.$outputs.color = pb.vec4(1);
      });
    },
  });
  const spriteUpdateProgram = pb.buildComputeProgram({
    label: 'spriteUpdate',
    workgroupSize: [64, 1, 1],
    compute() {
      const structParticle = pb.defineStruct('Particle', 'default', pb.vec2('pos'), pb.vec2('vel'));
      const structParams = pb.defineStruct('SimParams', 'std140',
        pb.float('deltaT'),
        pb.float('rule1Distance'),
        pb.float('rule2Distance'),
        pb.float('rule3Distance'),
        pb.float('rule1Scale'),
        pb.float('rule2Scale'),
        pb.float('rule3Scale'),
      );
      const structParticles = pb.defineStruct('Particles', 'default', structParticle[0]('particles'));
      this.params = structParams().uniform(0);
      this.particlesA = structParticles().storage(0);
      this.particlesB = structParticles().storage(0);
      this.$mainFunc(function () {
        this.index = this.$builtins.globalInvocationId.x;
        this.vPos = this.particlesA.particles.at(this.index).pos;
        this.vVel = this.particlesA.particles.at(this.index).vel;
        this.cMass = pb.vec2(0);
        this.cVel = pb.vec2(0);
        this.colVel = pb.vec2(0);
        this.cMassCount = pb.uint(0);
        this.cVelCount = pb.uint(0);
        this.pos = pb.vec2();
        this.vel = pb.vec2();
        this.$for(pb.uint('i'), 0, pb.arrayLength(pb.addressOf(this.particlesA.particles)), function () {
          this.$if(pb.equal(this.i, this.index), function () {
            this.$continue();
          });
          this.pos = this.particlesA.particles.at(this.i).pos.xy;
          this.vel = this.particlesA.particles.at(this.i).vel.xy;
          this.$if(pb.lessThan(pb.distance(this.pos, this.vPos), this.params.rule1Distance), function () {
            this.cMass = pb.add(this.cMass, this.pos);
            this.cMassCount = pb.add(this.cMassCount, 1);
          });
          this.$if(pb.lessThan(pb.distance(this.pos, this.vPos), this.params.rule2Distance), function () {
            this.colVel = pb.sub(this.colVel, pb.sub(this.pos, this.vPos));
          });
          this.$if(pb.lessThan(pb.distance(this.pos, this.vPos), this.params.rule3Distance), function () {
            this.cVel = pb.add(this.cVel, this.vel);
            this.cVelCount = pb.add(this.cVelCount, 1);
          });
        });
        this.$if(pb.greaterThan(this.cMassCount, 0), function () {
          this.temp = pb.float(this.cMassCount);
          this.cMass = pb.sub(pb.div(this.cMass, pb.vec2(this.temp)), this.vPos);
        });
        this.$if(pb.greaterThan(this.cVelCount, 0), function () {
          this.temp = pb.float(this.cVelCount);
          this.cVel = pb.div(this.cVel, pb.vec2(this.temp));
        });
        this.vVel = pb.add(this.vVel, pb.mul(this.cMass, this.params.rule1Scale));
        this.vVel = pb.add(this.vVel, pb.mul(this.colVel, this.params.rule2Scale));
        this.vVel = pb.add(this.vVel, pb.mul(this.cVel, this.params.rule3Scale));
        this.vVel = pb.mul(pb.normalize(this.vVel), pb.clamp(pb.length(this.vVel), 0, 0.1));
        this.vPos = pb.add(this.vPos, pb.mul(this.vVel, this.params.deltaT));
        this.$if(pb.lessThan(this.vPos.x, -1), function () {
          this.vPos.x = 1;
        });
        this.$if(pb.greaterThan(this.vPos.x, 1), function () {
          this.vPos.x = -1;
        });
        this.$if(pb.lessThan(this.vPos.y, -1), function () {
          this.vPos.y = 1;
        });
        this.$if(pb.greaterThan(this.vPos.y, 1), function () {
          this.vPos.y = -1;
        });
        this.particlesB.particles.at(this.index).pos = this.vPos;
        this.particlesB.particles.at(this.index).vel = this.vVel;
      });
    }
  });
  const spriteVertexBuffer = viewer.device.createStructuredBuffer(chaos.makeVertexBufferType(3, 'position_f32x2'), chaos.GPUResourceUsageFlags.BF_VERTEX | chaos.GPUResourceUsageFlags.MANAGED, new Float32Array([-0.01, -0.02, 0.01, -0.02, 0.0, 0.02]));
  const simParams = {
    deltaT: 0.04,
    rule1Distance: 0.1,
    rule2Distance: 0.025,
    rule3Distance: 0.025,
    rule1Scale: 0.02,
    rule2Scale: 0.05,
    rule3Scale: 0.005
  };
  const uniformBuffer = viewer.device.createStructuredBuffer(spriteUpdateProgram.getBindingInfo('params').type as chaos.PBStructTypeInfo, chaos.GPUResourceUsageFlags.BF_UNIFORM);
  const numParticles = 1500;
  const initialParticleData = new Float32Array(numParticles * 4);
  for (let i = 0; i < numParticles; ++i) {
    initialParticleData[4 * i + 0] = 2 * (Math.random() - 0.5);
    initialParticleData[4 * i + 1] = 2 * (Math.random() - 0.5);
    initialParticleData[4 * i + 2] = 2 * (Math.random() - 0.5) * 0.1;
    initialParticleData[4 * i + 3] = 2 * (Math.random() - 0.5) * 0.1;
  }
  const particleBuffers: chaos.StructuredBuffer[] = [];
  const particleBindGroups: chaos.BindGroup[] = [];
  const primitives: chaos.Primitive[] = [];
  for (let i = 0; i < 2; i++) {
    particleBuffers.push(viewer.device.createStructuredBuffer(chaos.makeVertexBufferType(numParticles, 'tex0_f32x2', 'tex1_f32x2'), chaos.GPUResourceUsageFlags.BF_VERTEX | chaos.GPUResourceUsageFlags.BF_STORAGE, initialParticleData));
  }
  for (let i = 0; i < 2; i++) {
    const bindGroup = viewer.device.createBindGroup(spriteUpdateProgram.bindGroupLayouts[0]);
    bindGroup.setBuffer('params', uniformBuffer);
    bindGroup.setBuffer('particlesA', particleBuffers[i]);
    bindGroup.setBuffer('particlesB', particleBuffers[(i + 1) % 2]);
    particleBindGroups.push(bindGroup);

    const primitive = new chaos.Primitive(viewer.device);
    primitive.primitiveType = chaos.PrimitiveType.TriangleList;
    primitive.setVertexBuffer(spriteVertexBuffer, 'vertex');
    primitive.setVertexBuffer(particleBuffers[i], 'instance');
    primitive.indexCount = 3;
    primitives.push(primitive);
  }

  function updateSimParams() {
    for (const k in simParams) {
      uniformBuffer.set(k, simParams[k]);
    }
  }
  updateSimParams();
  let t = 0;
  sceneView.addEventListener('draw', function (this: chaos.RElement, evt: chaos.REvent) {
    evt.preventDefault();
    viewer.device.setProgram(spriteUpdateProgram);
    viewer.device.setBindGroup(0, particleBindGroups[t % 2]);
    viewer.device.compute(Math.ceil(numParticles / 64), 1, 1);

    viewer.device.clearFrameBuffer(new chaos.Vector4(0, 0, 0, 1), 1, 0);
    viewer.device.setProgram(spriteProgram);
    viewer.device.setBindGroup(0, null);
    primitives[(t + 1) % 2].drawInstanced(numParticles);
    t++;
  });
  viewer.device.runLoop(device => GUI.render());

}());


