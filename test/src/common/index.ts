import * as chaos from 'balloon-device';

export function getQueryString(name: string) {
  return (new URL(window.location.toString())).searchParams.get(name) || null;
}

export interface ITestCase {
  caseName: string;
  times: number;
  execute: () => void;
}

export function assert(exp, msg) {
  if (!exp) {
    throw new Error(msg);
  }
}

async function delay() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function asyncWrapper(fn: Function, msg: HTMLElement, times: number) {
  return async function (...args: any[]) {
    try {
      for (const i of [...Array(times)].map((_, i) => i)) {
        msg.innerHTML = `testing... (${i}/${times})`;
        await Promise.resolve(fn(...args));
        await delay();
      }
      msg.style.color = '#00ff00';
      msg.innerHTML = 'Passed';
    } catch (err) {
      msg.style.color = '#ff0000';
      msg.innerHTML = `${err}`;
    }
  }
}

export async function doTest(desc: string, cases: ITestCase[]) {
  const title = document.getElementById('title');
  title.textContent = `${desc} - testing`;
  const table = document.getElementById('test-results');
  for (const testcase of cases) {
    const tr = document.createElement('tr');
    const tdname = document.createElement('td');
    tdname.innerHTML = testcase.caseName;
    tr.appendChild(tdname);
    const tdresult = document.createElement('td');
    tr.appendChild(tdresult);
    table.appendChild(tr);
    await asyncWrapper(testcase.execute, tdresult, testcase.times)();
  }
  title.textContent = `${desc} - finished`;
}

// sRGB to linear
function decodeColorString(s: string) {
  const value = parseInt(s.slice(1), 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return new chaos.Vector4(Math.pow(r / 255, 2.2), Math.pow(g / 255, 2.2), Math.pow(b / 255, 2.2), 1);
}

// linear to sRGB
function encodeColorString(color: chaos.Vector4) {
  const r = ('0' + ((Math.pow(color.x, 1 / 2.2) * 255) >> 0).toString(16)).slice(-2);
  const g = ('0' + ((Math.pow(color.y, 1 / 2.2) * 255) >> 0).toString(16)).slice(-2);
  const b = ('0' + ((Math.pow(color.z, 1 / 2.2) * 255) >> 0).toString(16)).slice(-2);
  return `#${r}${g}${b}`;
}

function createText(parent: chaos.RElement, value = '') {
  const text = parent.ownerDocument.createTextNode();
  text.textContent = value;
  parent.append(text);
  return text;
}

function createScroll(parent: chaos.RElement, value: number, stepValue = 0.1, rangeStart = 0, rangeEnd = 50) {
  const scroll = parent.ownerDocument.createElement<chaos.ScrollBar>('scrollbar');
  scroll.orientation = 'horizonal';
  scroll.stepValue = stepValue;
  scroll.rangeStart = rangeStart;
  scroll.rangeEnd = rangeEnd;
  scroll.buttonSize = 12;
  scroll.blockSize = 12;
  scroll.style.height = '20px';
  scroll.value = value;
  parent.append(scroll);
  return scroll;
}

function createButton(parent: chaos.RElement, text: string) {
  const btn = parent.ownerDocument.createElement<chaos.Button>('button');
  btn.textContent = text;
  parent.append(btn);
  return btn;
}

export function createLightTweakPanel(light: chaos.PunctualLight, el: chaos.RElement, styles?: any): chaos.RElement {
  const panel = el.ownerDocument.createElement('div');
  const defaultStyles = {
    width: '100%',
    height: 'auto',
    display: 'flex',
    flexFlow: 'column nowrap',
    alignItems: 'stretch',
    padding: '10px',
    color: '#ffff00',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  };
  const panelStyles = Object.assign({}, defaultStyles, styles || {});
  for (const k in panelStyles) {
    panel.style[k] = panelStyles[k];
  }

  {
    const label = createText(panel);
    const lightColorPicker = el.ownerDocument.createElement<chaos.Input>('input');
    lightColorPicker.type = 'color';
    lightColorPicker.value = encodeColorString(light.color);
    lightColorPicker.style.marginBottom = '5px';
    label.textContent = `light color: ${lightColorPicker.value}`;
    lightColorPicker.addEventListener('change', function () {
      light.color = decodeColorString(lightColorPicker.value);
      label.textContent = `light color: ${lightColorPicker.value}`;
    });
    panel.append(lightColorPicker);
  }

  {
    const label = createText(panel);
    const lightIntensitySlider = createScroll(panel, light.intensity, 0.1, 0, 100);
    lightIntensitySlider.style.marginBottom = '5px';
    label.textContent = `light intensity: ${lightIntensitySlider.value.toFixed(2)}`;
    lightIntensitySlider.addEventListener(chaos.RValueChangeEvent.NAME, function () {
      light.intensity = lightIntensitySlider.value;
      label.textContent = `light intensity: ${lightIntensitySlider.value.toFixed(2)}`;
    });
  }

  {
    if (light.isPointLight() || light.isSpotLight()) {
      const label = createText(panel);
      const lightRangeSlider = createScroll(panel, light.positionAndRange.w, 1, 1, 500);
      lightRangeSlider.style.marginBottom = '5px';
      label.textContent = `light range: ${lightRangeSlider.value.toFixed(3)}`;
      lightRangeSlider.addEventListener(chaos.RValueChangeEvent.NAME, function () {
        light.range = lightRangeSlider.value;
        label.textContent = `light range: ${lightRangeSlider.value.toFixed(1)}`;
      });
    }
  }

  {
    if (light.isSpotLight()) {
      const label = createText(panel);
      const lightCutoffSlider = createScroll(panel, light.directionAndCutoff.w, 0.02, 0, 1);
      lightCutoffSlider.style.marginBottom = '5px';
      label.textContent = `light cutoff: ${lightCutoffSlider.value.toFixed(3)}`;
      lightCutoffSlider.addEventListener(chaos.RValueChangeEvent.NAME, function () {
        light.cutoff = lightCutoffSlider.value;
        label.textContent = `light cutoff: ${lightCutoffSlider.value.toFixed(3)}`;
      });
    }
  }

  {
    const label = createText(panel);
    const castShadowSelector = el.ownerDocument.createElement<chaos.Select>('select');
    castShadowSelector.style.marginBottom = '5px';
    const optOn = el.ownerDocument.createElement<chaos.Option>('option');
    optOn.setAttribute('value', 'on');
    if (light.castShadow) {
      optOn.setAttribute('selected', 'selected');
    }
    optOn.textContent = 'On';
    castShadowSelector.append(optOn);
    const optOff = el.ownerDocument.createElement<chaos.Option>('option');
    optOff.setAttribute('value', 'off');
    if (!light.castShadow) {
      optOff.setAttribute('selected', 'selected');
    }
    optOff.textContent = 'Off';
    castShadowSelector.append(optOff);
    label.textContent = `cast shadow: ${castShadowSelector.value}`;
    castShadowSelector.addEventListener('change', function () {
      light.castShadow = castShadowSelector.value === 'on';
      label.textContent = `cast shadow: ${castShadowSelector.value}`;
    });
    panel.append(castShadowSelector);
  }

  {
    const label = createText(panel);
    const shadowMapSizeSelector = el.ownerDocument.createElement<chaos.Select>('select');
    shadowMapSizeSelector.style.marginBottom = '5px';
    for (const size of [32, 64, 128, 256, 512, 1024, 2048]) {
      const opt = el.ownerDocument.createElement<chaos.Option>('option');
      opt.setAttribute('value', `${size}`);
      if (light.shadow.shadowMapSize === size) {
        opt.setAttribute('selected', 'selected');
      }
      opt.textContent = `${size}`;
      shadowMapSizeSelector.append(opt);
    }
    label.textContent = `shadowmap size: ${shadowMapSizeSelector.value}`;
    shadowMapSizeSelector.addEventListener('change', function () {
      light.shadow.shadowMapSize = Number(shadowMapSizeSelector.value);
      label.textContent = `shadowmap size: ${shadowMapSizeSelector.value}`;
    });
    panel.append(shadowMapSizeSelector);
  }

  {
    const label = createText(panel);
    const depthBiasSlider = createScroll(panel, light.shadow.depthBias, 0.001, 0, 5);
    depthBiasSlider.style.marginBottom = '5px';
    label.textContent = `depth bias: ${depthBiasSlider.value.toFixed(3)}`;
    depthBiasSlider.addEventListener(chaos.RValueChangeEvent.NAME, function () {
      light.shadow.depthBias = depthBiasSlider.value;
      label.textContent = `depth bias: ${depthBiasSlider.value.toFixed(3)}`;
    });
  }

  {
    const label = createText(panel);
    const normalBiasSlider = createScroll(panel, light.shadow.normalBias, 0.001, 0, 5);
    normalBiasSlider.style.marginBottom = '5px';
    label.textContent = `normal bias: ${normalBiasSlider.value.toFixed(3)}`;
    normalBiasSlider.addEventListener(chaos.RValueChangeEvent.NAME, function () {
      light.shadow.normalBias = normalBiasSlider.value;
      label.textContent = `normal bias: ${normalBiasSlider.value.toFixed(3)}`;
    });
  }

  {
    if (light.isDirectionLight()) {
      const label = createText(panel);
      const numCascadesSlider = createScroll(panel, light.shadow.numShadowCascades, 1, 1, 4);
      numCascadesSlider.style.marginBottom = '5px';
      label.textContent = `cascade count: ${numCascadesSlider.value}`;
      numCascadesSlider.addEventListener(chaos.RValueChangeEvent.NAME, function () {
        light.shadow.numShadowCascades = numCascadesSlider.value;
        label.textContent = `cascade count: ${numCascadesSlider.value}`;
      });
    }
  }

  {
    const label = createText(panel);
    const backfaceSelector = el.ownerDocument.createElement<chaos.Select>('select');
    backfaceSelector.style.marginBottom = '5px';
    const optOn = el.ownerDocument.createElement<chaos.Option>('option');
    optOn.setAttribute('value', 'on');
    if (light.shadow.renderBackfaceOnly) {
      optOn.setAttribute('selected', 'selected');
    }
    optOn.textContent = 'On';
    backfaceSelector.append(optOn);
    const optOff = el.ownerDocument.createElement<chaos.Option>('option');
    optOff.setAttribute('value', 'off');
    if (!light.shadow.renderBackfaceOnly) {
      optOff.setAttribute('selected', 'selected');
    }
    optOff.textContent = 'Off';
    backfaceSelector.append(optOff);
    label.textContent = `render backface: ${backfaceSelector.value}`;
    backfaceSelector.addEventListener('change', function () {
      light.shadow.renderBackfaceOnly = backfaceSelector.value === 'on';
      label.textContent = `render backface: ${backfaceSelector.value}`;
    });
    panel.append(backfaceSelector);
  }

  {
    const label = createText(panel);
    const modeSelector = el.ownerDocument.createElement<chaos.Select>('select');
    modeSelector.style.marginBottom = '5px';
    for (const mode of ['hard', 'vsm', 'esm', 'pcf-pd', 'pcf-opt']) {
      const opt = el.ownerDocument.createElement<chaos.Option>('option');
      opt.setAttribute('value', mode);
      if (light.shadow.mode === mode) {
        opt.setAttribute('selected', 'selected');
      }
      opt.textContent = mode;
      modeSelector.append(opt);
    }
    label.textContent = `shadow mode: ${modeSelector.value}`;
    modeSelector.addEventListener('change', function () {
      light.shadow.mode = modeSelector.value as any;
      label.textContent = `shadow mode: ${modeSelector.value}`;
    });
    panel.append(modeSelector);
  }

  {
    const label = createText(panel);
    const depthScaleSlider = createScroll(panel, light.shadow.esmDepthScale, 1, 1, 2000);
    depthScaleSlider.style.marginBottom = '5px';
    label.textContent = `ESM depth scale: ${depthScaleSlider.value.toFixed(3)}`;
    depthScaleSlider.addEventListener(chaos.RValueChangeEvent.NAME, function () {
      light.shadow.esmDepthScale = depthScaleSlider.value;
      label.textContent = `depth scale: ${depthScaleSlider.value.toFixed(3)}`;
    });
  }

  {
    const label = createText(panel);
    const esmKernelSizeScaleSlider = createScroll(panel, light.shadow.esmBlurKernelSize, 2, 3, 25);
    esmKernelSizeScaleSlider.style.marginBottom = '5px';
    label.textContent = `ESM blur kernel: ${esmKernelSizeScaleSlider.value}`;
    esmKernelSizeScaleSlider.addEventListener(chaos.RValueChangeEvent.NAME, function () {
      light.shadow.esmBlurKernelSize = esmKernelSizeScaleSlider.value;
      label.textContent = `ESM blur kernel: ${esmKernelSizeScaleSlider.value}`;
    });
  }

  {
    const label = createText(panel);
    const esmBlurSizeScaleSlider = createScroll(panel, light.shadow.esmBlurRadius, 0.1, 0, 20);
    esmBlurSizeScaleSlider.style.marginBottom = '5px';
    label.textContent = `ESM blur radius: ${esmBlurSizeScaleSlider.value.toFixed(1)}`;
    esmBlurSizeScaleSlider.addEventListener(chaos.RValueChangeEvent.NAME, function () {
      light.shadow.esmBlurRadius = esmBlurSizeScaleSlider.value;
      label.textContent = `ESM blur radius: ${esmBlurSizeScaleSlider.value.toFixed(1)}`;
    });
  }

  {
    const label = createText(panel);
    const pcfTapCountSlider = createScroll(panel, light.shadow.pdSampleCount, 1, 1, 64);
    pcfTapCountSlider.style.marginBottom = '5px';
    label.textContent = `Poisson sample count: ${pcfTapCountSlider.value}`;
    pcfTapCountSlider.addEventListener(chaos.RValueChangeEvent.NAME, function () {
      light.shadow.pdSampleCount = pcfTapCountSlider.value;
      label.textContent = `Poisson sample count: ${pcfTapCountSlider.value}`;
    });
  }

  {
    const label = createText(panel);
    const pcfSampleRadiusSlider = createScroll(panel, light.shadow.pdSampleRadius, 0.1, 0, 50);
    pcfSampleRadiusSlider.style.marginBottom = '5px';
    label.textContent = `Poisson sample radius: ${pcfSampleRadiusSlider.value.toFixed(3)}`;
    pcfSampleRadiusSlider.addEventListener(chaos.RValueChangeEvent.NAME, function () {
      light.shadow.pdSampleRadius = pcfSampleRadiusSlider.value;
      label.textContent = `Poisson sample radius: ${pcfSampleRadiusSlider.value.toFixed(3)}`;
    });
  }

  {
    const label = createText(panel);
    const pcfKenelSizeSelctor = el.ownerDocument.createElement<chaos.Select>('select');
    pcfKenelSizeSelctor.style.marginBottom = '5px';
    for (const kernelSize of [3, 5, 7]) {
      const opt = el.ownerDocument.createElement<chaos.Option>('option');
      opt.setAttribute('value', String(kernelSize));
      if (light.shadow.pcfKernelSize === kernelSize) {
        opt.setAttribute('selected', 'selected');
      }
      opt.textContent = String(kernelSize);
      pcfKenelSizeSelctor.append(opt);
    }
    label.textContent = `PCF kernel size: ${pcfKenelSizeSelctor.value}`;
    pcfKenelSizeSelctor.addEventListener('change', function () {
      light.shadow.pcfKernelSize = Number(pcfKenelSizeSelctor.value);
      label.textContent = `PCF kernel size: ${pcfKenelSizeSelctor.value}`;
    });
    panel.append(pcfKenelSizeSelctor);
  }

  {
    const label = createText(panel);
    const vsmKernelSizeScaleSlider = createScroll(panel, light.shadow.vsmBlurKernelSize, 2, 3, 25);
    vsmKernelSizeScaleSlider.style.marginBottom = '5px';
    label.textContent = `VSM blur kernel: ${vsmKernelSizeScaleSlider.value}`;
    vsmKernelSizeScaleSlider.addEventListener(chaos.RValueChangeEvent.NAME, function () {
      light.shadow.vsmBlurKernelSize = vsmKernelSizeScaleSlider.value;
      label.textContent = `VSM blur kernel: ${vsmKernelSizeScaleSlider.value}`;
    });
  }

  {
    const label = createText(panel);
    const vsmBlurRadiusSlider = createScroll(panel, light.shadow.vsmBlurRadius, 0.1, 0, 20);
    vsmBlurRadiusSlider.style.marginBottom = '5px';
    label.textContent = `VSM blur radius: ${vsmBlurRadiusSlider.value.toFixed(3)}`;
    vsmBlurRadiusSlider.addEventListener(chaos.RValueChangeEvent.NAME, function () {
      light.shadow.vsmBlurRadius = vsmBlurRadiusSlider.value;
      label.textContent = `VSM blur radius: ${vsmBlurRadiusSlider.value.toFixed(3)}`;
    });
  }

  {
    const label = createText(panel);
    const vsmDarknessSlider = createScroll(panel, light.shadow.vsmDarkness, 0.01, 0, 0.999);
    vsmDarknessSlider.style.marginBottom = '5px';
    label.textContent = `VSM darkness: ${vsmDarknessSlider.value.toFixed(3)}`;
    vsmDarknessSlider.addEventListener(chaos.RValueChangeEvent.NAME, function () {
      light.shadow.vsmDarkness = vsmDarknessSlider.value;
      label.textContent = `VSM darkness: ${vsmDarknessSlider.value.toFixed(3)}`;
    });
  }

  el.append(panel);
  return panel;
}

export function createSceneTweakPanel(scene: chaos.Scene, el: chaos.RElement, styles?: any): chaos.RElement {
  const panel = el.ownerDocument.createElement('div');
  const defaultStyles = {
    width: '100%',
    height: 'auto',
    display: 'flex',
    flexFlow: 'column nowrap',
    alignItems: 'stretch',
    padding: '10px',
    color: '#ffff00',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  };
  const panelStyles = Object.assign({}, defaultStyles, styles || {});
  for (const k in panelStyles) {
    panel.style[k] = panelStyles[k];
  }

  {
    panel.append('env light strength:');
    const envLightStrengthSlider = createScroll(panel, scene.envLightStrength, 0.01, 0, 1);
    envLightStrengthSlider.style.marginBottom = '5px';
    envLightStrengthSlider.addEventListener(chaos.RValueChangeEvent.NAME, function () {
      scene.envLightStrength = Math.min(1, (Math.max(0, envLightStrengthSlider.value)));
    });
  }

  {
    panel.append('Press L to force context lost');
    panel.append('Press R to force context restore');
    window.addEventListener('keyup', key => {
      if (key.code === 'KeyL') {
        console.log('force context lost');
        scene.device.looseContext();
      } else if (key.code === 'KeyR') {
        console.log('force context restored');
        scene.device.restoreContext();
      }
    })
  }

  el.append(panel);
  return panel;
}

export function createTestPanel(scene: chaos.Scene, el: chaos.RElement, styles?: any): chaos.RElement {
  const assetManager = new chaos.AssetManager(scene.device);
  const panel = el.ownerDocument.createElement('div');
  const defaultStyles = {
    width: '100%',
    height: 'auto',
    display: 'flex',
    flexFlow: 'column nowrap',
    padding: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  };
  const panelStyles = Object.assign({}, defaultStyles, styles || {});
  for (const k in panelStyles) {
    panel.style[k] = panelStyles[k];
  }

  const deviceName = el.ownerDocument.createElement('div');
  deviceName.style.color = 'yellow';
  deviceName.style.marginTop = '5px';
  deviceName.textContent = `Device: ${scene.device.getDeviceType()}`;
  panel.append(deviceName);
  const timerCPU = el.ownerDocument.createElement('div');
  timerCPU.style.color = 'yellow';
  timerCPU.style.marginTop = '5px';
  panel.append(timerCPU);
  const timerGPU = el.ownerDocument.createElement('div');
  timerGPU.style.color = 'yellow';
  timerGPU.style.marginTop = '5px';
  panel.append(timerGPU);
  const lblFPS = el.ownerDocument.createElement('div');
  lblFPS.style.color = 'yellow';
  lblFPS.style.marginTop = '5px';
  panel.append(lblFPS);
  const mem = el.ownerDocument.createElement('div');
  mem.style.color = 'yellow';
  mem.style.marginTop = '5px';
  panel.append(mem);
  const lblDrawCall = el.ownerDocument.createElement('div');
  lblDrawCall.style.color = 'yellow';
  lblDrawCall.style.marginTop = '5px';
  panel.append(lblDrawCall);
  const lblComputeCall = el.ownerDocument.createElement('div');
  lblComputeCall.style.color = 'yellow';
  lblComputeCall.style.marginTop = '5px';
  panel.append(lblComputeCall);

  const env = el.ownerDocument.createElement<chaos.Select>('select');
  env.style.marginTop = '5px';
  const optNone = el.ownerDocument.createElement<chaos.Option>('option');
  optNone.setAttribute('value', 'none');
  optNone.textContent = 'None';
  env.append(optNone);
  const optSunset = el.ownerDocument.createElement('option');
  optSunset.setAttribute('value', 'sunset');
  optSunset.textContent = 'sunset';
  optSunset.setAttribute('selected', 'selected');
  env.append(optSunset);
  const optSnow = el.ownerDocument.createElement('option');
  optSnow.setAttribute('value', 'snow');
  optSnow.textContent = 'snow';
  env.append(optSnow);
  const optCristmas = el.ownerDocument.createElement('option');
  optCristmas.setAttribute('value', 'cristmas');
  optCristmas.textContent = 'cristmas';
  env.append(optCristmas);
  panel.append(env);

  let radianceMap: chaos.TextureCube = null;
  let irradianceMap: chaos.TextureCube = null;
  let skyMap: chaos.TextureCube = null;
  let skyBox: chaos.Mesh = null;
  let loading = false;
  let currentEnv = 'none';
  function changeEnv() {
    const name = env.value;
    if (name === currentEnv) {
      return;
    }
    if (loading) {
      env.setAttribute('value', currentEnv);
      return;
    }
    loading = true;
    currentEnv = name;
    const promises = name !== 'none'
      ? [
        assetManager.fetchTexture<chaos.TextureCube>(`./assets/images/environments/${name}/output_skybox.dds`),
        assetManager.fetchTexture<chaos.TextureCube>(`./assets/images/environments/${name}/output_pmrem.dds`),
        assetManager.fetchTexture<chaos.TextureCube>(`./assets/images/environments/${name}/output_iem.dds`)
      ]
      : [];
    Promise.all(promises).then(textures => {
      loading = false;
      radianceMap = null;
      irradianceMap = null;
      skyMap = null;
      if (textures.length === 0) {
        skyBox?.remove();
        scene.environment = null;
      } else {
        skyMap = textures[0];
        radianceMap = textures[1];
        irradianceMap = textures[2];
        if (scene.environment) {
          (scene.environment as chaos.EnvIBL).radianceMap = radianceMap;
          (scene.environment as chaos.EnvIBL).irradianceMap = irradianceMap;
        } else {
          scene.environment = new chaos.EnvIBL(radianceMap, irradianceMap);
        }
        if (skyBox) {
          (skyBox.material as chaos.SkyboxMaterial).skyCubeMap = skyMap;
          skyBox.reparent(scene.rootNode);
        } else {
          skyBox = scene.addSkybox(skyMap) as chaos.Mesh;
        }
      }
    }).catch(err => {
      loading = false;
      throw new Error(`load environment failed: ${name}`);
    });
  }
  env.addEventListener('change', function () {
    changeEnv();
  });
  scene.device.addEventListener('frameend', evt => {
    const e = evt as chaos.DeviceFrameEnd;
    const frameInfo = e.device.frameInfo;
    if (frameInfo.frameCounter % 60 === 0) {
      timerCPU.textContent = `CPU time: ${frameInfo.elapsedTimeCPU.toFixed(2)}ms`;
      timerGPU.textContent = `GPU time: ${frameInfo.elapsedTimeGPU.toFixed(2)}ms`;
      lblFPS.textContent = `FPS: ${frameInfo.FPS.toFixed(2)}`;
      mem.textContent = `Memory: ${Math.ceil(e.device.videoMemoryUsage / 1024 / 1024)}M`;
      lblDrawCall.textContent = `DrawCall: ${frameInfo.drawCalls}`;
      lblComputeCall.textContent = `ComputeCall: ${frameInfo.computeCalls}`;
    }
  });
  el.append(panel);
  changeEnv();
  return panel;
}

export function createTextureViewPanel(device: chaos.Device, el: chaos.RElement, width: number): chaos.RElement {
  const textureViewerPanel = el.ownerDocument.createElement('div');
  textureViewerPanel.style.position = 'absolute';
  textureViewerPanel.style.right = 0;
  textureViewerPanel.style.top = 0;
  initTextureViewPanel(device, textureViewerPanel, width);
  el.append(textureViewerPanel);
  return textureViewerPanel;
}

export function initTextureViewPanel(device: chaos.Device, el: chaos.RElement, width: number) {
  el.style.display = 'flex';
  el.style.flexFlow = 'column nowrap';
  el.style.padding = '10px';
  el.style.width = `${width + 20}px`;
  el.style.height = 'auto';
  el.style.backgroundColor = 'white';
  el.style.color = 'yellow';
  const textureSelect = el.ownerDocument.createElement<chaos.Select>('select');
  textureSelect.id = 'select-textures';
  textureSelect.style.padding = '5px';
  textureSelect.style.backgroundColor = '#aaa';
  el.append(textureSelect);
  const textureViewer = el.ownerDocument.createElement('div');
  textureViewer.style.height = '1px';
  (textureViewer as any).viewer = new TextureView(device, textureViewer, width);
  el.append(textureViewer);
  const textureList = device.getGPUObjects().textures;
  for (const tex of textureList) {
    if (tex.isTexture2D()) {
      const option = el.ownerDocument.createElement<chaos.Option>('option');
      option.setAttribute('value', String(tex.uid));
      option.textContent = tex.name;
      textureSelect.append(option);
    }
  }
  if (textureSelect.value) {
    const texture = device.getGPUObjectById(Number(textureSelect.value));
    (textureViewer as any).viewer.texture = texture;
  }
  textureSelect.addEventListener('change', function () {
    const texture = device.getGPUObjectById(Number(textureSelect.value));
    (textureViewer as any).viewer.texture = texture;
  });
  function onDeviceAddGPUObject(this: chaos.Device, e: chaos.REvent) {
    const evt = e as chaos.DeviceGPUObjectAddedEvent;
    if (evt.object.isTexture2D()) {
      const option = textureSelect.ownerDocument.createElement<chaos.Option>('option');
      option.setAttribute('value', String((evt as chaos.DeviceGPUObjectAddedEvent).object.uid));
      option.textContent = evt.object.name;
      textureSelect.prepend(option);
    }
  }
  function onDeviceRemoveGPUObject(this: chaos.Device, e: chaos.REvent) {
    const evt = e as chaos.DeviceGPUObjectRemovedEvent;
    if (evt.object.isTexture2D()) {
      const options = textureSelect.querySelectorAll('option');
      for (const node of options.values()) {
        const option = node as chaos.Option;
        if (Number(option.getAttribute('value')) === evt.object.uid) {
          option.remove();
          break;
        }
      }
    }
  }
  function onRenameGPUObject(this: chaos.Device, e: chaos.REvent) {
    const evt = e as chaos.DeviceGPUObjectRenameEvent;
    if (evt.object.isTexture2D()) {
      const options = textureSelect.querySelectorAll('option');
      for (const node of options.values()) {
        const option = node as chaos.Option;
        if (Number(option.getAttribute('value')) === evt.object.uid) {
          option.textContent = evt.object.name;
          break;
        }
      }
    }
  }
  device.addEventListener('gpuobject_added', onDeviceAddGPUObject);
  device.addEventListener('gpuobject_removed', onDeviceRemoveGPUObject);
  device.addEventListener('gpuobject_rename', onRenameGPUObject);
}

export class TextureView {
  private _el: chaos.RElement;
  private _device: chaos.Device;
  private _tex: chaos.Texture2D;
  private _program: chaos.GPUProgram;
  private _programNonFilterable: chaos.GPUProgram;
  private _programDepth: chaos.GPUProgram;
  private _programBk: chaos.GPUProgram;
  private _rect: chaos.Primitive;
  private _bindGroup: chaos.BindGroup;
  private _bindGroupNonFilterable: chaos.BindGroup;
  private _bindGroupDepth: chaos.BindGroup;
  private _renderStates: chaos.RenderStateSet;
  private _width: number;
  private _mode: number;
  constructor(device: chaos.Device, container: chaos.RElement, width: number) {
    this._device = device;
    this._el = container;
    this._el.customDraw = true;
    this._tex = null;
    this._width = width;
    this._mode = 0;
    this.init();
    const that = this;
    this._el.addEventListener('draw', function (this: chaos.RElement, evt: chaos.REvent) {
      evt.preventDefault();
      that._device.setBindGroup(0, null);
      that._device.setBindGroup(1, null);
      that._device.setBindGroup(2, null);
      that._device.setBindGroup(3, null);
      that._device.setProgram(that._programBk);
      that._device.setRenderStates(that._renderStates);
      that._rect.draw();
      if (that._tex && that._tex.isTexture2D() && !that._tex.disposed) {
        const depth = chaos.isDepthTextureFormat(that._tex.format);
        const filterable = that._tex.isFilterable();
        const program = depth ? that._programDepth : filterable ? that._program : that._programNonFilterable;
        const bindGroup = depth ? that._bindGroupDepth : filterable ? that._bindGroup : that._bindGroupNonFilterable;
        bindGroup.setTexture('tex', that._tex);
        bindGroup.setValue('linearOutput', 0);
        bindGroup.setValue('mode', that._mode);
        that._device.setBindGroup(0, bindGroup);
        that._device.setProgram(program);
        that._rect.draw();
      }
    });
  }
  get texture(): chaos.Texture2D {
    return this._tex;
  }
  set texture(tex: chaos.Texture2D) {
    if (this._tex !== tex) {
      this._tex = tex;
      this._el.style.height = `${Math.max(1, Math.floor(this._width * (tex.height / tex.width)))}px`;
    }
  }
  get width(): number {
    return this._width;
  }
  set width(w: number) {
    this._width = w;
  }
  private init() {
    const vb = this._device.createStructuredBuffer(
      chaos.makeVertexBufferType(4, 'position_f32x2', 'tex0_f32x2'),
      chaos.GPUResourceUsageFlags.BF_VERTEX | chaos.GPUResourceUsageFlags.MANAGED,
      new Float32Array([-1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0]));
    this._rect = new chaos.Primitive(this._device);
    this._rect.setVertexBuffer(vb);
    this._rect.indexStart = 0;
    this._rect.indexCount = 4;
    this._rect.primitiveType = chaos.PrimitiveType.TriangleStrip;
    this._renderStates = this._device.createRenderStateSet();
    this._renderStates.useRasterizerState().setCullMode(chaos.FaceMode.NONE);
    this._renderStates.useDepthState().enableTest(false).enableWrite(false);
    this._renderStates.useBlendingState().enable(true).setBlendFunc(chaos.BlendFunc.ONE, chaos.BlendFunc.INV_SRC_ALPHA);
    this._program = this.createDefaultShader(false, false);
    this._programNonFilterable = this.createDefaultShader(false, true);
    this._programDepth = this.createDefaultShader(true, false);
    this._programBk = this.createBkShader();
    this._bindGroup = this._device.createBindGroup(this._program.bindGroupLayouts[0]);
    this._bindGroupNonFilterable = this._device.createBindGroup(this._programNonFilterable.bindGroupLayouts[0]);
    this._bindGroupDepth = this._device.createBindGroup(this._programDepth.bindGroupLayouts[0]);
  }
  private createDefaultShader(depth: boolean, unfilterableFloat: boolean): chaos.GPUProgram {
    const pb = new chaos.ProgramBuilder(this._device);
    return pb.buildRenderProgram({
      vertex() {
        this.$inputs.pos = pb.vec2().attrib('position');
        this.$inputs.uv = pb.vec2().attrib('texCoord0');
        this.$outputs.uv = pb.vec2();
        this.$mainFunc(function () {
          this.$builtins.position = pb.vec4(this.$inputs.pos, 0, 1);
          this.$outputs.uv = this.$inputs.uv;
        });
      },
      fragment() {
        this.tex = depth ? pb.tex2DShadow().uniform(0) : pb.tex2D().sampleType(unfilterableFloat ? 'unfilterable-float' : null).uniform(0);
        this.linearOutput = pb.int().uniform(0);
        this.mode = pb.int().uniform(0);
        this.$outputs.color = pb.vec4();
        this.$mainFunc(function () {
          this.c = pb.textureSample(this.tex, this.$inputs.uv);
          this.$if(pb.equal(this.mode, 1), function () {
            this.c = this.c.xxxw;
          }).$elseif(pb.equal(this.mode, 2), function () {
            this.c = this.c.yyyw;
          }).$elseif(pb.equal(this.mode, 3), function () {
            this.c = this.c.zzzw;
          }).$elseif(pb.equal(this.mode, 4), function () {
            this.c = this.c.wwww;
          });
          this.$if(pb.notEqual(this.linearOutput, 0), function () {
            this.$outputs.color = pb.vec4(pb.mul(this.c.xyz, this.c.w), this.c.w);
          }).$else(function () {
            this.$outputs.color = pb.vec4(pb.mul(pb.pow(this.c.xyz, pb.vec3(1 / 2.2)), this.c.w), this.c.w);
          });
        });
      }
    });
  }
  private createBkShader(): chaos.GPUProgram {
    const pb = new chaos.ProgramBuilder(this._device);
    return pb.buildRenderProgram({
      vertex() {
        this.$inputs.pos = pb.vec2().attrib('position');
        this.$inputs.uv = pb.vec2().attrib('texCoord0');
        this.$outputs.uv = pb.vec2();
        this.$mainFunc(function () {
          this.$builtins.position = pb.vec4(this.$inputs.pos, 0, 1);
          this.$outputs.uv = pb.mul(this.$inputs.uv, 16);
        });
      },
      fragment() {
        this.$outputs.color = pb.vec4();
        this.$mainFunc(function () {
          this.color0 = pb.vec4(1, 1, 1, 1);
          this.color1 = pb.vec4(0.6, 0.6, 0.6, 1);
          this.c = pb.div(pb.floor(this.$inputs.uv), 2);
          this.checker = pb.mul(pb.fract(pb.add(this.c.x, this.c.y)), 2);
          this.$outputs.color = pb.add(pb.mul(this.color0, this.checker), pb.mul(this.color1, pb.sub(1, this.checker)));
        });
      }
    });
  }
}
