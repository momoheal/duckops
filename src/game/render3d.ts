import * as THREE from 'three';
import type { FireZone, Game } from './game';
import { FEATHER_COLORS, P_DUST, P_FIRE, P_MUZZLE, P_RING, P_SMOKE, P_SPARK } from './game';
import type { Floor, RaidMapId, SceneryProp, Solid } from './map';
import type { Enemy } from './game';
import { createTerrain } from './terrain3d';

const tilt = Math.SQRT1_2;
function gableGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -.5,-.5,.5, .5,-.5,.5, 0,.5,.5,
    -.5,-.5,-.5, 0,.5,-.5, .5,-.5,-.5,
  ],3));
  geometry.computeVertexNormals();
  return geometry;
}
function roofSlopeGeometry(side: -1 | 1) {
  const geometry = new THREE.BufferGeometry();
  const positions = side < 0 ? [
    -.5,-.5,.5, 0,.5,.5, 0,.5,-.5,
    -.5,-.5,.5, 0,.5,-.5, -.5,-.5,-.5,
  ] : [
    0,.5,.5, .5,-.5,.5, .5,-.5,-.5,
    0,.5,.5, .5,-.5,-.5, 0,.5,-.5,
  ];
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  return geometry;
}
function chestLidGeometry() {
  const section = new THREE.Shape();
  section.moveTo(-.5, -.5);
  for (let i = 1; i <= 8; i++) {
    const angle = Math.PI * (1 - i / 8);
    section.lineTo(.5 * Math.cos(angle), Math.sin(angle) - .5);
  }
  section.closePath();
  return new THREE.ExtrudeGeometry(section, { depth: 1, bevelEnabled: false })
    .translate(0, 0, -.5).rotateY(Math.PI / 2);
}
function hangarRoofGeometry() {
  const positions: number[] = [];
  const segments = 8;
  for (let i = 0; i < segments; i++) {
    const a = i / segments, b = (i + 1) / segments;
    const ax = a - .5, bx = b - .5;
    const ay = Math.sin(a * Math.PI) - .5, by = Math.sin(b * Math.PI) - .5;
    positions.push(ax,ay,.5, bx,by,.5, bx,by,-.5, ax,ay,.5, bx,by,-.5, ax,ay,-.5);
    positions.push(ax,-.5,.5, bx,-.5,.5, bx,by,.5, ax,-.5,.5, bx,by,.5, ax,ay,.5);
    positions.push(bx,-.5,-.5, ax,-.5,-.5, ax,ay,-.5, bx,-.5,-.5, ax,ay,-.5, bx,by,-.5);
  }
  const roof = new THREE.BufferGeometry();
  roof.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roof.computeVertexNormals();
  return roof;
}

// Coordinates follow the 2D sprites: negative length is the nose.
function aircraftPanel(points: [number, number][], thickness: number, vertical = false) {
  const outline = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  outline.closePath();
  const panel = new THREE.ExtrudeGeometry(outline, { depth: thickness, bevelEnabled: false });
  panel.translate(0, 0, -thickness / 2);
  return vertical ? panel.rotateY(-Math.PI / 2) : panel.rotateX(Math.PI / 2);
}

function aircraftHull(stations: [number, number][]) {
  return new THREE.LatheGeometry(stations.map(([length, radius]) => new THREE.Vector2(radius, length)), 16)
    .rotateX(Math.PI / 2);
}

type BoatVertex = [number, number, number];
// A shared perimeter keeps the rim of the hull flush with the open cockpit.
const BOAT_OUTLINE: [number, number][] = [
  [0, -.5], [.26, -.37], [.44, -.18], [.5, 0], [.43, .18], [.26, .37],
  [0, .5], [-.26, .37], [-.43, .18], [-.5, 0], [-.44, -.18], [-.26, -.37],
];
const boatOpening = () => BOAT_OUTLINE.map(([x, z]): BoatVertex => [x * .84, .39, z * .9]);

function boatHullGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const triangle = (a: BoatVertex, b: BoatVertex, c: BoatVertex) => {
    positions.push(...a, ...b, ...c, ...c, ...b, ...a);
  };
  const quad = (a: BoatVertex, b: BoatVertex, c: BoatVertex, d: BoatVertex) => {
    triangle(a, b, c); triangle(a, c, d);
  };
  // Double-ended perimeter: pointed bow and stern, broad amidships.
  const rim = BOAT_OUTLINE.map(([x, z]): BoatVertex => [x, .39, z]);
  const innerRim = boatOpening();
  const keel = BOAT_OUTLINE.map(([x, z]): BoatVertex => [x * .16, -.5, z * .92]);
  for (let i = 0; i < rim.length; i++) {
    const next = (i + 1) % rim.length;
    quad(rim[i], keel[i], keel[next], rim[next]);
    quad(rim[i], rim[next], innerRim[next], innerRim[i]);
  }
  const keelCenter: BoatVertex = [0, -.5, 0];
  for (let i = 0; i < keel.length; i++) triangle(keelCenter, keel[i], keel[(i + 1) % keel.length]);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function boatInteriorGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const triangle = (a: BoatVertex, b: BoatVertex, c: BoatVertex) => {
    positions.push(...a, ...b, ...c, ...c, ...b, ...a);
  };
  const quad = (a: BoatVertex, b: BoatVertex, c: BoatVertex, d: BoatVertex) => {
    triangle(a, b, c); triangle(a, c, d);
  };
  const opening = boatOpening();
  const floor = BOAT_OUTLINE.map(([x, z]): BoatVertex => [x * .43, -.16, z * .55]);
  for (let i = 0; i < opening.length; i++) {
    const next = (i + 1) % opening.length;
    quad(opening[i], floor[i], floor[next], opening[next]);
  }
  const floorCenter: BoatVertex = [0, -.16, 0];
  for (let i = 0; i < floor.length; i++) triangle(floorCenter, floor[i], floor[(i + 1) % floor.length]);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function flameGeometry() {
  const points = [[.22, -.5], [.48, -.32], [.33, -.02], [.19, .22], [.075, .39], [0, .5]];
  const mesh = new THREE.LatheGeometry(points.map(([radius, height]) => new THREE.Vector2(radius, height)), 7);
  const vertices = mesh.getAttribute('position');
  for (let i = 0; i < vertices.count; i++) {
    const height = vertices.getY(i) + .5;
    vertices.setX(i, vertices.getX(i) + .32 * height * height);
  }
  mesh.computeVertexNormals();
  return mesh;
}

function groundPatchGeometry() {
  const mesh = new THREE.CircleGeometry(.5, 32).rotateX(-Math.PI / 2);
  const vertices = mesh.getAttribute('position');
  for (let i = 1; i < vertices.count; i++) {
    const a = Math.atan2(vertices.getZ(i), vertices.getX(i));
    const radius = .92 + Math.sin(a * 5) * .055 + Math.cos(a * 9) * .025;
    vertices.setXYZ(i, vertices.getX(i) * radius, 0, vertices.getZ(i) * radius);
  }
  return mesh;
}

const geometry = () => ({
  block: new THREE.BoxGeometry(1,1,1),
  round: new THREE.SphereGeometry(.5,12,8),
  drum: new THREE.CylinderGeometry(.5,.5,1,12),
  crown: new THREE.IcosahedronGeometry(.5,0),
  pine: new THREE.ConeGeometry(.5, 1, 7),
  ring: new THREE.TorusGeometry(.5,.012,5,56).rotateX(-Math.PI/2),
  projectile: new THREE.IcosahedronGeometry(.5,1),
  flame: flameGeometry(),
  groundPatch: groundPatchGeometry(),
  chestLid: chestLidGeometry(),
  hangarRoof: hangarRoofGeometry(),
  gable: gableGeometry(),
  roofLeft: roofSlopeGeometry(-1),
  roofRight: roofSlopeGeometry(1),
  boatHull: boatHullGeometry(),
  boatInterior: boatInteriorGeometry(),
  fighterHull: aircraftHull([[-60,0],[-53,3],[-36,8],[-15,10],[3,11],[37,8],[53,5],[53,0]]),
  fighterGlove: aircraftPanel([[0,-22],[14,-19],[28,-3],[24,28],[16,43],[-16,43],[-24,28],[-28,-3],[-14,-19]], 3.8),
  fighterWing: aircraftPanel([[0,-10],[18,-8],[58,22],[57,31],[20,23],[0,26],[-20,23],[-57,31],[-58,22],[-18,-8]], 3),
  fighterTail: aircraftPanel([[0,34],[10,33],[31,50],[29,54],[9,49],[0,47],[-9,49],[-29,54],[-31,50],[-10,33]], 2.6),
  fighterFin: aircraftPanel([[32,0],[53,0],[48,17],[39,17]], 2.9, true),
  cargoHull: aircraftHull([[-81,0],[-77,8],[-65,14],[-48,17],[34,17],[55,14],[73,8],[81,3],[81,0]]),
  cargoWing: aircraftPanel([[0,-24],[39,-23],[82,-17],[86,-14],[84,0],[39,10],[0,12],[-39,10],[-84,0],[-86,-14],[-82,-17],[-39,-23]], 5),
  cargoTail: aircraftPanel([[0,53],[15,54],[39,66],[38,73],[0,68],[-38,73],[-39,66],[-15,54]], 3.4),
  cargoFin: aircraftPanel([[45,0],[77,0],[69,28],[59,28]], 4, true),
  /** Upright glow volume for fixtures and existing telegraphs. */
  disc: new THREE.CylinderGeometry(.5,.5,1,20).rotateX(-Math.PI/2),
});
type Shape = keyof ReturnType<typeof geometry>;
type Batch = { mesh: THREE.InstancedMesh; used: number };

const SCENE_BG: Record<string,string> = {
  island: '#4d604b', harbor: '#46565c', foundry: '#4a443c',
  hatchery: '#42522f', outpost: '#5c6e74', mausoleum: '#4b483d',
  airbase: '#4c4a45',
};
const BUILDING_ART = {
  island: { wall: '#b1ad96', roof: '#b5653e', shade: '#8d4532', trim: '#dca95f', fascia: '#744831', gable: '#d8ad7c', rise: .235 },
  harbor: { wall: '#829697', roof: '#537e84', shade: '#385b67', trim: '#a6b7b1', fascia: '#354b51', gable: '#8fa6a1', rise: .12 },
  foundry: { wall: '#a48a71', roof: '#704a40', shade: '#4c3532', trim: '#b68663', fascia: '#463637', gable: '#a97458', rise: .13 },
  hatchery: { wall: '#9c996c', roof: '#8c6544', shade: '#664d36', trim: '#c3a779', fascia: '#51412f', gable: '#af9060', rise: .21 },
  outpost: { wall: '#9caeb4', roof: '#b3c6cb', shade: '#829ba7', trim: '#e2eff0', fascia: '#536d79', gable: '#9aabb0', rise: .12 },
  airbase: { wall: '#9a9d92', roof: '#717e79', shade: '#4d5e5b', trim: '#bac0a7', fascia: '#455451', gable: '#9aab9b', rise: .10 },
  mausoleum: { wall: '#aca28b', roof: '#725873', shade: '#4e3c54', trim: '#e0bd73', fascia: '#64464e', gable: '#beab8c', rise: .19 },
};
const CARGO_COLORS: Record<RaidMapId, [string, string, string]> = {
  island: ['#c6533d', '#287d89', '#d4a128'],
  harbor: ['#527d84', '#a4563f', '#334e57'],
  foundry: ['#8c5142', '#5b4b43', '#b28a34'],
  hatchery: ['#71814c', '#895d38', '#a78b4d'],
  outpost: ['#a4bbc1', '#687b84', '#d3e6eb'],
  airbase: ['#727c70', '#795b4d', '#8e9ca0'],
  mausoleum: ['#76627b', '#9c804e', '#716e62'],
};
const FENCE_COLORS: Record<RaidMapId, [string, string]> = {
  island: ['#9c835d', '#ad9166'], harbor: ['#566f70', '#91a8a2'],
  foundry: ['#6c5550', '#a36a50'], hatchery: ['#6c6545', '#a58b59'],
  outpost: ['#687c83', '#aebfc2'], airbase: ['#5b6661', '#9da69d'],
  mausoleum: ['#71685d', '#b49b70'],
};

// Main garment, trim and body proportions. The head keeps its feather color.
const BOSS_OUTFITS: Partial<Record<Enemy['type'], {
  coat: string; trim: string; length: number; width: number; height: number;
}>> = {
  goose:        { coat: '#294736', trim: '#87723b', length: 2.14, width: 1.64, height: 1.62 },
  harborBoss:   { coat: '#254963', trim: '#326d7b', length: 2.48, width: 2.12, height: 1.82 },
  foundryBoss:  { coat: '#64332a', trim: '#a65b31', length: 2.72, width: 2.32, height: 1.92 },
  broodQueen:   { coat: '#536f39', trim: '#86964c', length: 2.31, width: 1.81, height: 1.28 },
  frostMarshal: { coat: '#3e647b', trim: '#81afba', length: 1.98, width: 1.60, height: 1.71 },
  ironGuard:    { coat: '#38252b', trim: '#8d302a', length: 2.33, width: 1.98, height: 1.66 },
  duckKing:     { coat: '#5b366d', trim: '#97713c', length: 2.24, width: 1.73, height: 1.73 },
  flameAce:     { coat: '#643326', trim: '#c65d32', length: 1.91, width: 1.42, height: 1.46 },
  radarWarden:  { coat: '#315364', trim: '#66939e', length: 2.08, width: 1.63, height: 1.62 },
};

export class WorldRenderer3D {
  private gl: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1,1,1,-1,1,9000);
  private shapes = geometry();
  private material = new THREE.MeshStandardMaterial({roughness:.88,flatShading:true});
  private batches = new Map<string,Batch>();
  private translucent = new Map<number,THREE.MeshStandardMaterial>();
  /** Emissive glow batches (fire, sparks, telegraphs) drawn with additive blending. */
  private glowBatches = new Map<string,Batch>();
  private glowMaterial = new THREE.MeshBasicMaterial({transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false});
  private glowOpacities = new Map<number,THREE.MeshBasicMaterial>();
  private colors = new Map<string,THREE.Color>();
  private actorAlpha = 1;
  private transform = new THREE.Object3D();
  private color = new THREE.Color();
  private width = 1;
  private height = 1;
  private terrain?: ReturnType<typeof createTerrain>;
  private map?: Game['map'];
  private animT = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'high-performance' });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.75));
    // Keep light-facing roof and box faces from clipping to pure white.
    this.gl.toneMapping = THREE.NeutralToneMapping;
    this.scene.background = new THREE.Color(SCENE_BG.island);
    this.scene.add(new THREE.HemisphereLight('#fff8df','#aaa783',1.95));
    const sun = new THREE.DirectionalLight('#fff0cc',2.1);
    sun.position.set(-350,650,300); this.scene.add(sun);
  }

  resize(width: number,height: number) {
    this.width = Math.max(1,width); this.height = Math.max(1,height);
    this.gl.setSize(this.width,this.height,false);
  }

  screenToWorld(g: Game,sx: number,sy: number) {
    const c = g.cam;
    return {x:c.x+c.kx+(sx-this.width/2-c.sx)/c.zoom, y:c.y+c.ky+(sy-this.height/2-c.sy)/(c.zoom*tilt)};
  }

  worldToScreen(g: Game,x: number,y: number,height=0) {
    const c=g.cam;
    return {x:this.width/2+c.sx+(x-c.x-c.kx)*c.zoom, y:this.height/2+c.sy+(y-height-c.y-c.ky)*c.zoom*tilt};
  }

  private removeTerrain() {
    if (!this.terrain) return;
    this.scene.remove(this.terrain);
    this.terrain.geometry.dispose(); this.terrain.material.map?.dispose(); this.terrain.material.dispose();
  }

  /** Acquire (or grow) an instanced batch for shape+opacity in the given bucket. */
  private batchFor(buckets: Map<string,Batch>, materials: Map<number,THREE.Material>, makeMaterial: () => THREE.Material, shape: Shape, opacity: number): Batch {
    const key = shape+opacity;
    let batch=buckets.get(key);
    if (!batch || batch.used === batch.mesh.instanceMatrix.count) {
      let material=materials.get(opacity);
      if(!material) {
        material=makeMaterial(); materials.set(opacity,material);
      }
      const mesh = new THREE.InstancedMesh(this.shapes[shape],material,batch ? batch.used*2 : 128);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if(batch) {
        (mesh.instanceMatrix.array as Float32Array).set(batch.mesh.instanceMatrix.array);
        mesh.setColorAt(0,this.color);
        (mesh.instanceColor!.array as Float32Array).set(batch.mesh.instanceColor!.array);
        this.scene.remove(batch.mesh); batch.mesh.dispose();
      }
      batch = {mesh,used:batch?.used ?? 0}; buckets.set(key,batch); this.scene.add(mesh);
    }
    return batch;
  }

  private stamp(shape: Shape,x: number,y: number,z: number,w: number,h: number,d: number,color: string,angle=0,alpha=this.actorAlpha,pitch=0,roll=0) {
    const opacity = Math.min(1, Math.round(alpha * 8) / 8);
    if (opacity <= 0) return;
    const batch = this.batchFor(this.batches,this.translucent,()=>{
      const m=this.material.clone(); m.transparent=opacity<1; m.opacity=opacity; m.depthWrite=opacity>=1; return m;
    },shape,opacity);
    this.transform.position.set(x,z,y);
    this.transform.scale.set(w,h,d); this.transform.rotation.set(pitch,-angle,roll); this.transform.updateMatrix();
    batch.mesh.setMatrixAt(batch.used,this.transform.matrix);
    let linear=this.colors.get(color);
    if(!linear) {
      const css=color.replace(/^rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)$/,'rgb($1,$2,$3)');
      linear=new THREE.Color(css); this.colors.set(color,linear);
    }
    batch.mesh.setColorAt(batch.used++,linear);
  }

  /** Emissive additive stamp — fire, sparks, telegraph discs and glow rings. */
  private stampGlow(shape: Shape,x: number,y: number,z: number,w: number,h: number,d: number,color: string,angle=0,alpha=1) {
    // Animated alpha must reuse the same small set of materials across frames.
    const opacity = Math.min(1, Math.round(alpha * 12) / 12);
    if (opacity <= 0) return;
    const batch = this.batchFor(this.glowBatches,this.glowOpacities,()=>{
      const m=this.glowMaterial.clone(); m.opacity=opacity; return m;
    },shape,opacity);
    this.transform.position.set(x,z,y);
    this.transform.scale.set(w,h,d); this.transform.rotation.set(0,-angle,0); this.transform.updateMatrix();
    batch.mesh.setMatrixAt(batch.used,this.transform.matrix);
    let linear=this.colors.get(color);
    if(!linear) {
      const css=color.replace(/^rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)$/,'rgb($1,$2,$3)');
      linear=new THREE.Color(css); this.colors.set(color,linear);
    }
    batch.mesh.setColorAt(batch.used++,linear);
  }

  private behindPlayer(g:Game,x:number,y:number,w:number,d:number,height:number) {
    const p=g.player;
    return g.mode==='raid' && Math.abs(p.x-x)<w/2+p.r && p.y<y+d/2+p.r && p.y>y-height/tilt-d/2-p.r;
  }

  private cover(s: Solid,g:Game) {
    if (s.dead || ['bound','water','tree','container','asset'].includes(s.kind)) return;
    const art = BUILDING_ART[g.mapId];
    const x=s.x+(s.t===0?s.w/2:0),y=s.y+(s.t===0?s.h/2:0);
    if (s.kind === 'train') { this.trainCar(s,g,x,y); return; }
    if(s.t===1) {
      this.stamp('drum',x,y,9,s.r*2,18,s.r*2,s.kind==='barrel'?'#b9573f':'#786549');
      this.stamp('drum',x,y,14,s.r*2+.5,3,s.r*2+.5,'#4d5148'); return;
    }
    const castle = s.kind === 'castle_wall';
    const wall = s.kind === 'wall' || castle;
    const [fencePost, fenceRail] = FENCE_COLORS[g.mapId];
    const cargoColor=CARGO_COLORS[g.mapId][Math.abs(Math.round(s.v))%3];
    const color = castle ? '#614179' : wall?art.wall:s.kind==='cargo'?cargoColor:s.kind==='fence'?'#9e9273':'#818779';
    const h=castle?68:wall?48:s.kind==='cargo'?36:s.kind==='rack'?25:s.kind==='fence'?34:21;
    this.stamp('block',x+h*.12,y-h*.12,.35,s.w+h*.24,.45,s.h+h*.24,'#35402e',0,.25);
    const alpha=this.behindPlayer(g,x,y,s.w,s.h,h) ? .2 : 1;
    this.actorAlpha=alpha;
    this.stamp('block',x,y,h/2,s.w,h,s.h,color,0,alpha);
    this.stamp('block',x,y,h+1,s.w+1,2,s.h+1,castle?'#e0b95e':wall?art.trim:s.kind==='cargo'?art.gable:'#b3b29b',0,alpha);
    if (castle) {
      this.stamp('block', x, y, 7, s.w + 3, 14, s.h + 3, '#3f2e51');
      this.stamp('block', x, y, 47, s.w + 2, 3, s.h + 2, '#b78d48');
    }
    if(s.kind==='cargo') {
      const alongX=s.w>s.h, length=Math.max(s.w,s.h);
      const rail=alongX?s.h:s.w;
      for(let t=-length/2+7;t<length/2;t+=12) {
        const ribX=x+(alongX?t:0),ribY=y+(alongX?0:t);
        this.stamp('block',ribX,ribY,h*.53,alongX?3.2:s.w*.86,h*.86,alongX?rail*.9:3.2,'#173f42');
        this.stamp('block',ribX,ribY,h*.53+1,alongX?1.5:s.w*.86,h*.86,alongX?rail*.84:1.5,color);
      }
      for(const end of [-1,1]) {
        const ex=x+(alongX?end*(length/2-5):0),ey=y+(alongX?0:end*(length/2-5));
        this.stamp('block',ex,ey,h*.52,alongX?7:s.w,h*.9,alongX?s.h:7,'#e7c778');
        this.stamp('block',ex,ey,h*.7,alongX?4:s.w*.82,h*.18,alongX?s.h*.82:4,'#303d3a');
      }
      this.stamp('block',x,y,4,alongX?s.w:s.w*.88,3,alongX?s.h*.88:s.h,'#263e3c');
    }
    if(s.kind==='fence') {
      const alongX=s.w>s.h, length=Math.max(s.w,s.h), count=Math.max(2,Math.floor(length/20));
      for(let i=0;i<=count;i++) {
        const offset=-length/2+length*i/count;
        this.stamp('block',x+(alongX?offset:0),y+(alongX?0:offset),h*.58,alongX?3.5:3,h*1.15,alongX?3:3.5,fencePost);
      }
      for(const z of [h*.35,h*.88])this.stamp('block',x,y,z,alongX?length:4,3,alongX?4:length,fenceRail);
    }
    this.actorAlpha=1;
  }

  /** Rail solids reuse the reference boxcar asset; long spans become coupled cars. */
  private trainCar(s: Solid, g: Game, x: number, y: number) {
    this.actorAlpha = this.behindPlayer(g, x, y, s.w, s.h, 42) ? .2 : 1;
    const rot = s.w >= s.h ? 0 : Math.PI / 2;
    const len = Math.max(s.w, s.h), width = Math.min(s.w, s.h);
    const count = Math.max(1, Math.round(len / 150));
    const gap = 8;
    const scale = Math.min(len / (count * 166 + (count - 1) * gap), width / 42);
    const liveries = ['#825344', '#3f6573', '#556447', '#8a5a3c'];
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * (166 * scale + gap);
      this.lowPolyProp({
        kind: i % 2 ? 'freight_flatcar' : 'freight_boxcar',
        x: x + offset * Math.cos(rot), y: y + offset * Math.sin(rot),
        rot, scale, paint: liveries[(Math.abs(Math.round(s.v)) + i) % liveries.length],
      });
    }
    this.actorAlpha = 1;
  }

  private lowPolyProp(prop: SceneryProp) {
    const {x,y,scale,rot,kind}=prop;
    const block=(dx:number,dy:number,z:number,w:number,h:number,d:number,color:string,angle=rot)=>
      this.stamp('block',x+dx*Math.cos(rot)-dy*Math.sin(rot),y+dx*Math.sin(rot)+dy*Math.cos(rot),z,w*scale,h*scale,d*scale,color,angle);
    const part = (shape: Shape, dx: number, dy: number, z: number, w: number, h: number, d: number, color: string, pitch = 0, opacity = 1) =>
      this.stamp(shape, x + scale * (dx * Math.cos(rot) - dy * Math.sin(rot)),
        y + scale * (dx * Math.sin(rot) + dy * Math.cos(rot)), z * scale, w * scale, h * scale, d * scale, color, rot, this.actorAlpha * opacity, pitch);
    switch (kind) {
      case 'royal_flagpole':
        part('drum', 0, 0, 4, 20, 8, 20, '#8c7d72');
        part('drum', 0, 0, 9, 14, 4, 14, '#c9ab73');
        this.royalFlag(x, y, 11 * scale, rot, scale, this.actorAlpha);
        return;
      case 'castle_steps': {
        const length = prop.len ?? 60;
        const width = prop.width ?? 100;
        const steps = Math.ceil(length / 13);
        const depth = length / steps;
        for (let i = 0; i < steps; i++) {
          const height = 2 + (steps - i - 1) * 1.45;
          const stepX = -length / 2 + (i + .5) * depth;
          part('block', stepX, 0, height / 2, depth, height, width, i % 2 ? '#a69b8e' : '#b8ac9e');
          part('block', stepX + depth / 2 - 1, 0, height, 2, .8, width, '#d9c9ae');
          for (const side of [-1, 1]) part('block', stepX, side * (width / 2 - 3), height + 1,
            depth, 2, 6, '#97764d');
        }
        return;
      }
      case 'freight_boxcar':
      case 'freight_flatcar': {
        // Both kinds share the reference boxcar silhouette; `paint` supplies the livery variant.
        const color = prop.paint ?? (kind === 'freight_boxcar' ? '#825344' : '#536963');
        part('block', 0, 0, 9, 154, 8, 36, '#403a33');
        for (const axle of [-54, -41, 41, 54]) {
          part('block', axle, 0, 5, 4, 4, 27, '#4d4941');
          for (const side of [-1, 1]) part('drum', axle, side * 11, 5, 10, 4, 10, '#353333', Math.PI / 2);
        }
        for (const side of [-1, 1]) part('block', side * 78, 0, 9, 10, 6, 7, '#53453b');
        part('block', 0, 0, 28, 145, 34, 38, color);
        part('block', 0, 0, 46, 151, 4, 42, '#616357');
        for (const side of [-1, 1]) {
          part('block', 0, side * 19, 28, 40, 31, 2, '#513d33');
          part('block', 0, side * 20, 28, 34, 27, 2, color);
          part('block', 0, side * 21, 29, 25, 2, 2, '#aa8a59');
          for (const dx of [-59, -36, 36, 59]) part('block', dx, side * 19, 28, 3, 32, 3, '#674a3e');
        }
        // Roof vents sit on the centre line, not scattered across the deck.
        for (const dx of [-38, 38]) {
          part('block', dx, 0, 50, 22, 8, 14, '#4a4d48');
          part('block', dx, 0, 55, 15, 4, 9, '#6f7167');
        }
        return;
      }
      case 'checkpoint_gate': {
        const red = '#ad3732', white = '#eee3c9';
        part('block', -49, 0, 4, 24, 8, 26, '#4a4842');
        part('block', -49, 0, 20, 15, 29, 16, red);
        part('block', -49, 0, 35, 15, 6, 16, '#5e5346');
        part('block', 49, 0, 15, 6, 29, 8, '#514b42');
        for (let i = 0; i < 9; i++) {
          part('block', -48 + i * 12, 0, 31, 12, 6, 5, i % 2 ? red : white);
        }
        return;
      }
      case 'water_barrier': {
        const red = '#b83e33', white = '#ede3cf';
        part('block', 0, 0, 3, 70, 6, 26, '#92342a');
        for (let i = 0; i < 5; i++) {
          part('block', (i - 2) * 14, 0, 12, 14, 16, 21, i % 2 ? white : red);
          part('block', (i - 2) * 14, 0, 20, 14, 4, 14, i % 2 ? white : red);
        }
        part('drum', -23, 0, 23, 7, 3, 7, '#574840');
        part('drum', 23, 0, 23, 7, 3, 7, '#574840');
        return;
      }
      case 'striped_barricade':
        for (const side of [-1, 1]) {
          part('block', side * 25, 0, 2, 7, 4, 24, '#4b4941');
          part('block', side * 25, 0, 13, 5, 22, 5, '#5f5b51');
        }
        for (const height of [12, 25]) {
          for (let i = 0; i < 8; i++) {
            part('block', (i - 3.5) * 8, 0, height, 8, 7, 5, i % 2 ? '#e9dfc8' : '#b94238');
          }
        }
        return;
      case 'fountain': {
        part('drum', 0, 0, 3, 84, 6, 72, '#626962');
        part('drum', 0, 0, 9, 78, 8, 66, '#8d8f81');
        part('drum', 0, 0, 13, 82, 4, 70, '#c4bfaa');
        part('drum', 0, 0, 15, 71, 1.8, 59, '#408595');
        part('drum', 0, 0, 16, 62, .8, 50, '#61a9b2');
        const cycle = this.animT * .62 + (x % 97) / 97;
        for (const offset of [0, .5]) {
          const phase = (cycle + offset) % 1;
          const diameter = 23 + phase * 39;
          part('ring', 0, 0, 16.8, diameter, 2, diameter * .79, '#d2f3e9', 0, (1 - phase) * .76);
        }
        part('drum', 0, 0, 19, 22, 10, 20, '#8b9081');
        part('drum', 0, 0, 24, 25, 3, 22, '#c2baa3');
        part('round', 0, 2, 30, 19, 12, 20, '#e9ba43');
        part('round', 0, 8, 37, 13, 13, 12, '#ffdb66');
        part('round', 0, 14, 34, 8, 3, 6, '#ce7535');
        for (const side of [-1, 1]) part('round', side * 3, 12, 39, 1.8, 2.2, 1.8, '#332822');
        for (let stream = 0; stream < 4; stream++) {
          const angle = (stream + .5) * Math.PI / 2;
          for (const delay of [0, .34, .68]) {
            const phase = (cycle * 2 + delay + stream * .09) % 1;
            const reach = 9 + phase * 17;
            const height = 23 - phase * 6 + 35 * phase * (1 - phase);
            part('round', Math.cos(angle) * reach, Math.sin(angle) * reach, height,
              2.8 - phase, 3.6 - phase, 2.8 - phase, '#bde8ed', 0, .85 - phase * .24);
          }
        }
        return;
      }
      case 'duck_king_statue':
        part('block', 0, 0, 3, 62, 6, 62, '#5f594d');
        part('block', 0, 0, 11, 51, 10, 51, '#807563');
        part('block', 0, 0, 17, 57, 4, 57, '#c4b69a');
        part('block', 0, 26, 11, 23, 7, 1, '#ad8948');
        part('block', 0, 26.7, 11, 14, 1.1, .6, '#dfc48b');
        part('crown', 0, -16, 29, 20, 17, 17, '#a8792a');
        part('round', 0, -4, 31, 40, 26, 34, '#c39638');
        for (const side of [-1, 1]) {
          part('round', side * 16, -1, 33, 11, 17, 21, '#e3b54e');
          part('round', side * 8, 16, 51, 3.1, 3.3, 3.1, '#654722');
          part('round', side * 9, 18, 22, 11, 4, 10, '#b97a2c');
        }
        part('round', 0, 8, 49, 26, 25, 22, '#edc15a');
        part('round', 0, 20, 46, 15, 6, 12, '#ad6428');
        part('drum', 0, 8, 61, 25, 5, 22, '#a46d24');
        part('drum', 0, 8, 63, 24, 2, 21, '#ebba46');
        for (const dx of [-9, 0, 9]) part('crown', dx, 9, dx ? 67 : 70, 9, dx ? 11 : 16, 9, '#ffdb6d');
        part('crown', 0, 18, 64, 5, 6, 3, '#994943');
        return;
      case 'royal_lantern':
        part('block', 0, 0, 4, 18, 8, 18, '#756452');
        part('drum', 0, 0, 18, 6, 22, 6, '#633e2c');
        part('block', 0, 0, 35, 16, 19, 16, '#ef9740');
        for (const dx of [-7, 7]) for (const dy of [-7, 7]) part('block', dx, dy, 35, 2, 22, 2, '#713c2d');
        part('crown', 0, 0, 47, 23, 10, 23, '#ad542e');
        return;
      case 'king_vault_gate':
        for (const dx of [-52, 52]) {
          part('block', dx, 0, 20, 16, 40, 14, '#625846');
          part('block', dx, -7, 24, 6, 35, 2, '#b99752');
        }
        part('block', 0, 0, 45, 120, 10, 17, '#817057');
        part('block', 0, 0, 51, 116, 4, 20, '#d5b86e');
        part('drum', 0, 0, 56, 11, 6, 11, '#edd28a');
        return;
      case 'rune_pillar':
        part('block', 0, 0, 5, 29, 10, 29, '#665f57');
        part('block', 0, 0, 30, 18, 44, 18, '#91877b');
        part('crown', 0, 0, 54, 22, 15, 22, '#b4936d');
        for (const z of [22, 32, 42]) part('block', 0, 9.5, z, 9, 2, 1, '#dbaaeb');
        return;
      case 'stone_lion':
        part('block', 0, 0, 5, 32, 10, 50, '#777166');
        part('round', 0, -5, 21, 24, 23, 35, '#aaa08d');
        part('crown', 0, 10, 32, 25, 25, 21, '#817763');
        part('crown', 0, 15, 32, 17, 17, 17, '#c1b29a');
        for (const side of [-1, 1]) {
          part('crown', side * 10, 11, 42, 10, 10, 10, '#918774');
          part('round', side * 5, 22, 39, 3.5, 4, 3, '#373630');
        }
        part('crown', 0, 23, 35, 11, 8, 8, '#c1b29a');
        part('round', 0, 28, 36, 3.8, 2.8, 3.8, '#51483d');
        for (const dx of [-8, 8]) part('block', dx, 15, 13, 8, 7, 14, '#b4a694');
        return;
      case 'rope_coil':
        for (const z of [3, 6, 9]) part('ring', 0, 0, z, 35 - z, 12, 33 - z, '#bb925d');
        part('block', 9, 8, 2, 19, 3, 4, '#8f683f');
        return;
      case 'buoy':
        part('drum', 0, 0, 5, 23, 10, 23, '#813f32');
        part('crown', 0, 0, 15, 20, 22, 20, '#cf5b3e');
        part('drum', 0, 0, 21, 12, 4, 12, '#f6dda7');
        return;
      case 'pipe_run':
        for (const dy of [-5, 5]) {
          part('block', 0, dy, 8, 88, 7, 7, '#756452');
          for (const dx of [-35, 0, 35]) part('block', dx, dy, 7, 5, 12, 8, '#bd8659');
        }
        return;
      case 'cargo_net':
        // The net sits over a small load, with visible rope crossing the crown.
        part('block', 0, 0, 5, 48, 5, 39, '#584a37');
        part('block', -8, -3, 13, 21, 16, 25, '#657153');
        part('block', 9, 3, 12, 22, 14, 25, '#746345');
        part('crown', 0, 0, 19, 32, 13, 29, '#8b7753');
        for (const dx of [-17, -9, 0, 9, 17]) part('block', dx, 0, 25.5, 2.2, 2, 37, '#c3a36b');
        for (const dy of [-13, -6, 2, 10, 16]) part('block', 0, dy, 25.5, 49, 2, 2.2, '#c3a36b');
        // Two diagonal lashings make the woven cover readable at game scale.
        this.stamp('block', x, y, 27, 2.6 * scale, 2.2 * scale, 55 * scale, '#d3b37a', rot + Math.PI / 4);
        this.stamp('block', x, y, 27, 2.6 * scale, 2.2 * scale, 55 * scale, '#d3b37a', rot - Math.PI / 4);
        return;
      case 'water_bucket':
        part('drum', 0, 0, 8, 22, 15, 22, '#815a37');
        part('drum', 0, 0, 16, 25, 6, 25, '#9b7147');
        part('ring', 0, 0, 19, 24, 2, 24, '#8e9891');
        part('drum', 0, 0, 20, 16, 1.2, 16, '#355e67');
        for (const z of [5, 15]) part('ring', 0, 0, z, z === 5 ? 23 : 25, 1.4, z === 5 ? 23 : 25, '#b5a17a');
        for (const dx of [-8, 8]) part('block', dx, 0, 11, 2, 14, 2, '#d1b07a');
        return;
      case 'trash_bin':
        part('drum', 0, 0, 13, 24, 25, 24, '#3d6862');
        part('drum', 0, 0, 26, 28, 5, 28, '#314b48');
        part('block', 0, -3, 29, 11, 1.5, 7, '#202f2c');
        part('block', -10, 0, 8, 2, 9, 2, '#b9a888');
        part('block', 10, 0, 8, 2, 9, 2, '#b9a888');
        return;
      case 'mailbox':
        part('drum', 0, 2, 10, 5, 20, 5, '#5c5140');
        part('block', 0, 0, 26, 25, 20, 21, '#3d7180');
        part('crown', 0, -1, 37, 27, 5, 23, '#547f87');
        part('block', 0, -10.5, 27, 12, 2, 2, '#263a3c');
        part('block', 14, 0, 28, 8, 2, 2, '#a94a3c');
        part('block', 14, 0, 34, 2, 11, 2, '#c65442');
        return;
      case 'bench_park':
        for (const dy of [-7, 0, 7]) part('block', 0, dy, 17, 54, 3, 5, dy === 0 ? '#a87e4e' : '#916940');
        for (const dx of [-21, 21]) {
          part('block', dx, 5, 7, 4, 14, 4, '#4c4b3d');
          part('block', dx, -7, 16, 4, 23, 4, '#554a39');
        }
        for (const dy of [-11, -4]) part('block', 0, dy, 31, 54, 4, 4, '#a77b49');
        return;
      case 'wood_bridge': {
        const length = prop.len ?? 180, width = prop.width ?? 70;
        part('block', 0, 0, 4, length, 7, width, '#60442c');
        const plankCount = Math.max(8, Math.floor(length / 13));
        const plankSpacing = length / plankCount;
        for (let i = 0; i < plankCount; i++) {
          const dx = -length / 2 + plankSpacing * (i + .5);
          const tone = i % 3 === 0 ? '#aa8050' : i % 3 === 1 ? '#987147' : '#b28a55';
          part('block', dx, 0, 9, plankSpacing - 1.5, 3, width - 8, tone);
          part('block', dx, 0, 10.8, 1, .7, width - 8, '#c49c66');
        }
        for (const side of [-1, 1]) {
          part('block', 0, side * (width / 2 - 3), 11, length, 6, 6, '#6f4e31');
          for (let dx = -length / 2 + 16; dx < length / 2; dx += 42)
            part('block', dx, side * (width / 2 - 3), 14, 5, 12, 6, '#775638');
        }
        return;
      }
        return;
      case 'ingot_stack':
        for (const dy of [-10, 0, 10]) part('block', 0, dy, 4, 44, 8, 9, '#666968');
        for (const dy of [-5, 5]) part('block', 0, dy, 11, 35, 6, 9, '#a7a49a');
        return;
      case 'spore_pod':
        for (const dx of [-9, 0, 9]) {
          part('drum', dx, dx * .4, 8, 4, 16, 4, '#767440');
          part('crown', dx, dx * .4, dx ? 14 : 22, 14, dx ? 16 : 25, 14, '#9d803c');
          part('round', dx, dx * .4, dx ? 20 : 30, 4, 4, 4, '#dfd978');
        }
        return;
      case 'cattail':
        for (const dx of [-9, 0, 8]) {
          part('drum', dx, dx * .45, 10, 2, 20, 2, '#738655');
          part('drum', dx, dx * .45, 22 + dx * .3, 4, 10, 4, '#815c3a');
        }
        return;
      case 'well':
        part('drum', 0, 0, 10, 48, 20, 48, '#8c8981');
        part('drum', 0, 0, 21, 42, 4, 42, '#b2a796');
        part('drum', 0, 0, 24, 34, 2, 34, '#395960');
        for (const dx of [-17, 17]) part('block', dx, 0, 34, 4, 29, 4, '#795639');
        part('block', 0, 0, 48, 41, 5, 6, '#a4774e');
        return;
      case 'bus_stop':
        for (const dx of [-32, 32]) part('block', dx, -12, 22, 5, 44, 5, '#546565');
        part('block', 0, -13, 25, 64, 28, 3, '#6c8c88');
        part('block', 0, 0, 45, 76, 6, 36, '#526e70');
        part('block', 0, 3, 16, 49, 5, 11, '#aa895b');
        part('block', 29, 15, 26, 12, 12, 3, '#eacb74');
        // 站牌：蓝底 + 暖色线路条，俯视下也容易辨认
        part('drum', 30, -16, 20, 4, 40, 4, '#3e4a4c');
        part('block', 30, -16, 37, 19, 18, 3, '#285b6b');
        part('block', 30, -16, 39, 13, 4, 3.5, '#f2d995');
        part('block', 30, -16, 32, 9, 3, 3.5, '#9fd8e0');
        return;
      case 'signpost': {
        part('drum', 0, 0, 3, 13, 6, 13, '#665b46');
        part('block', 0, 0, 27, 5, 52, 5, '#79694e');
        const boards = [
          { z: 46, dy: 9, w: 50, h: 11, col: '#2e7d72' },
          { z: 34, dy: -11, w: 42, h: 10, col: '#a56f3c' },
        ];
        for (const board of boards) {
          part('block', 0, board.dy, board.z, board.w, board.h, 3, board.col);
          block(-board.w / 2 - 3, board.dy, board.z, 10, 10, 3, board.col, rot + Math.PI / 4);
          block(board.w / 2 + 3, board.dy, board.z, 10, 10, 3, board.col, rot + Math.PI / 4);
          part('block', 0, board.dy, board.z + 1.8, board.w * .55, 2.6, 3.5, '#e8d7a4');
        }
        return;
      }
      case 'laundry_line':
        for (const dx of [-30, 30]) part('block', dx, 0, 18, 4, 36, 4, '#6d553c');
        part('block', 0, 0, 34, 62, 1.5, 1.5, '#b79a72');
        for (const [dx, color] of [[-16, '#e3cfaa'], [0, '#a6584b'], [17, '#92ada0']] as const)
          part('block', dx, 0, 27, 12, 15, 2, color);
        return;
      case 'lava_pool':
      case 'lava_fissure': {
        const pool = kind === 'lava_pool';
        const width = pool ? 134 : 118, depth = pool ? 98 : 35;
        part('groundPatch', 0, 0, .8, width + 20, 1, depth + 23, '#272124');
        part('groundPatch', 0, 0, 1.3, width, 1, depth, '#87361e');
        part('groundPatch', 0, 0, 1.6, width * .91, 1, depth * .83, '#de5425');
        const drift = this.animT * 1.25 + x * .03;
        this.stampGlow('groundPatch', x, y, 2.05, width * scale * .93, 1, depth * scale * .85,
          '#ff6330', rot, .12 + .06 * Math.sin(drift));
        const fragments = pool ? 10 : 7;
        for (let i = 0; i < fragments; i++) {
          const a = i * Math.PI * 2 / fragments;
          part('crown', Math.cos(a) * width * .46, Math.sin(a) * depth * .44,
            2.5, 11 + i % 3 * 5, 7 + i % 3 * 3, pool ? 12 : 8, i % 2 ? '#493335' : '#29252a');
        }
        for (let i = 0; i < (pool ? 6 : 3); i++) {
          const a = i * 2.4 + drift * .22;
          const dx = Math.cos(a) * width * .27, dy = Math.sin(a) * depth * .26;
          part('groundPatch', dx, dy, 2.2, 14 + 5 * (i % 3), 1, 5 + Math.sin(drift + i) * 1.8, '#ffc45e');
          if (i % 2) continue;
          const progress = (drift * .47 + i * .39) % 1;
          this.stampGlow('crown', x + dx * scale + progress * 11, y + dy * scale - progress * 7, 4 + progress * 29,
            2.7, 2.7, 2.7, '#ff9b4a', 0, (1 - progress) * .85);
        }
        if (pool) for (let i = 0; i < 5; i++) {
          const a = i * 2.39996 + .38;
          part('groundPatch', Math.cos(a) * width * .36, Math.sin(a) * depth * .34,
            2.5, 21 + i * 2, 1, 8 + i * 2, i % 2 ? '#74402d' : '#4f302a');
        }
        return;
      }
      case 'basalt_spires': {
        part('groundPatch', 0, 0, .8, 75, 1, 56, '#2e272b');
        for (let i = 0; i < 5; i++) {
          const a = i * 2.39996;
          const r = i ? 17 : 0;
          const height = [39, 22, 30, 16, 25][i];
          part('drum', Math.cos(a) * r, Math.sin(a) * r, height * .47, 16, height, 16,
            i % 2 ? '#53464a' : '#39363d');
          part('crown', Math.cos(a) * r, Math.sin(a) * r, height - 2, 16, 9, 16, '#5b4c4f');
        }
        return;
      }
      case 'steam_vent': {
        part('groundPatch', 0, 0, .9, 46, 1, 37, '#30282a');
        for (let i = 0; i < 5; i++) {
          const a = i * Math.PI * 2 / 5;
          part('crown', Math.cos(a) * 11, Math.sin(a) * 9, 3, 11, 9, 9, '#5b4240');
        }
        for (let i = 0; i < 4; i++) {
          const age = (this.animT * .43 + i / 4 + (x % 71) / 71) % 1;
          part('round', age * 35, age * 17, 5 + age * 68, 9 + age * 24, 8 + age * 15, 11 + age * 20,
            '#9d8780', 0, (1 - age) * .42);
        }
        return;
      }
    }
    if(['delivery_truck','pickup_truck','dump_truck','container_truck','flatbed'].includes(kind)) {
      const cargo=kind==='dump_truck'?'#bd942c':kind==='pickup_truck'?'#3679ad':kind==='delivery_truck'?'#d8d2c0':'#7e7969';
      const truckW=kind==='pickup_truck'?46:54, truckL=kind==='flatbed'?104:124;
      for(const side of [-1,1]) for(const along of [-.31,.31]) {
        const wheel=side*truckW*.48, offset=along*truckL;
        this.stamp('drum',x+wheel*Math.cos(rot)-offset*Math.sin(rot),y+wheel*Math.sin(rot)+offset*Math.cos(rot),7,14*scale,12*scale,20*scale,'#292b2b',rot);
      }
      block(0,kind==='flatbed'?17:0,13,truckW,16,truckL,cargo);
      block(0,-truckL*.28,24,truckW*.82,15,truckL*.34,kind==='container_truck'?'#677b68':kind==='delivery_truck'?'#eee5cc':'#477eae');
      block(0,-truckL*.39,32,truckW*.68,11,3,'#263642');
      if(kind==='container_truck')for(let i=0;i<7;i++)block(0,truckL*.04+i*truckL*.105,24,truckW*.84,20,truckL*.09,['#728365','#b06048','#71868b'][i%3]);
      if(kind==='dump_truck')block(0,truckL*.22,28,truckW*.72,12,truckL*.36,'#c8982d');
      block(-truckW*.36,-truckL*.28,12,4,8,truckL*.48,'#ece3cb');
      block(truckW*.36,-truckL*.28,12,4,8,truckL*.48,'#ece3cb');
      return;
    }
    if(kind==='egg_nest'||kind==='nest_cluster') {
      const radius=(kind==='egg_nest'?27:48)*scale;
      this.stamp('round',x,y,4,radius*2,7,radius*1.45,'#725638',rot);
      for(let i=0;i<7;i++) {
        const a=i*Math.PI*2/7, px=x+Math.cos(a)*radius*.68,py=y+Math.sin(a)*radius*.48;
        this.stamp('drum',px,py,8,5*scale,8*scale,24*scale,'#957047',a);
      }
      for(let i=0;i<3;i++)this.stamp('round',x+(i-1)*radius*.4,y+((i%2)-.5)*radius*.22,13,13*scale,18*scale,11*scale,'#f1dfad');
      return;
    }
    if(kind==='barrels') { for(let i=0;i<3;i++)this.stamp('drum',x+(i-1)*15*scale,y+(i%2)*7*scale,11,15*scale,23*scale,15*scale,i===1?'#52615c':'#934e3a',rot); return; }
    if (kind === 'fighter_jet' || kind === 'fighter_jet_parked') {
      const parked = kind === 'fighter_jet_parked';
      const hull = parked ? '#778588' : '#929ea3';
      const wing = parked ? '#64767b' : '#788991';
      this.stamp('round', x, y + 3, .45, 110 * scale, .7, 102 * scale, '#303b3c', rot, this.actorAlpha * .32);
      part('fighterHull', 0, 0, 16, 1, .78, 1, hull);
      part('fighterGlove', 0, 0, 16, 1, 1, 1, hull);
      part('fighterWing', 0, 0, 15, 1, 1, parked ? .81 : 1, wing);
      part('fighterTail', 0, 0, 14, 1, 1, 1, wing);
      part('round', 0, -25, 23, 14, 12, 33, '#344c58');
      part('round', -1.7, -29, 28, 5, 2, 22, '#799ca5');
      for (const side of [-1, 1]) {
        part('round', side * 10.5, 28, 14, 16, 13, 53, '#69777c');
        part('block', side * 11, 1, 15, 10, 7, 3, '#333f45');
        part('drum', side * 10.5, 49, 14, 12, 10, 12, '#525b5b', Math.PI / 2);
        part('drum', side * 10.5, 54, 14, 8, 2, 8, '#303334', Math.PI / 2);
        part('fighterFin', side * 11.5, 0, 18, 1, 1, 1, '#59696e');
        part('block', side * 49, parked ? 19 : 25, 17, 6, 1.8, 4, side < 0 ? '#a84b3b' : '#4e785f');
        part('block', side * 14, 21, 7, 2.5, 10, 3, '#687073');
        part('drum', side * 14, 21, 3.6, 7, 3, 7, '#303738', 0, Math.PI / 2);
      }
      part('block', 0, -31, 7, 2.5, 10, 3, '#687073');
      part('drum', 0, -31, 3.4, 6, 3, 6, '#303738', 0, Math.PI / 2);
      return;
    }
    if(kind==='rowboat'||kind==='fishing_boat'||kind==='speedboat') {
      // Keep the former 38x93 footprint while replacing the slab with a low-poly,
      // double-pointed shell and a recessed cockpit shared by all three boats.
      const hullW=Math.max(18/scale,38), hullL=Math.max(54/scale,93);
      const hullColor=kind==='rowboat'?'#795b3e':kind==='fishing_boat'?'#496c70':'#d1d4ca';
      const insideColor=kind==='rowboat'?'#51402e':kind==='fishing_boat'?'#263f43':'#263b43';
      part('boatHull',0,0,7,hullW,12,hullL,hullColor);
      part('boatInterior',0,0,7,hullW,12,hullL,insideColor);
      if(kind==='rowboat') {
        // Two simple cross-benches make the open wooden interior easy to read.
        for(const dy of [-14,13])part('block',0,dy,9,25,3,3,'#bd9560');
        for(const side of [-1,1])part('block',side*14,0,8,2,2,42,'#9f784b');
      } else if(kind==='fishing_boat') {
        // Small raised helm cabin, pale roof and windshield distinguish the work boat.
        part('block',0,-16,13,15,10,19,'#3e5e61');
        part('block',0,-16,18.5,17,2,21,'#b8b7a1');
        part('block',0,-6.5,15,11,5,2.2,'#91b8bd');
        part('block',0,12,9,24,3,3,'#b28d5c');
        part('block',-14,0,8,2,1.5,42,'#c3a06a');
        part('block',14,0,8,2,1.5,42,'#c3a06a');
      } else {
        // Sport-boat cockpit and bright twin pinstripes, with a low front screen.
        for(const side of [-1,1])part('block',side*13,0,8,2.2,1.5,46,'#c1493a');
        part('block',0,-15,12,15,7,17,'#263e49');
        part('block',0,-8.5,17,14,5,2.4,'#86bac4');
        part('block',0,3,9,13,2.5,6,'#647c80');
      }
      return;
    }
    if(kind==='hangar') {
      // Arch-roof hangar: tall shell, ribbed roof segments and a lit door mouth.
        const w=128,d=80,wallH=52;
      block(0,0,wallH/2,w,wallH,d,'#7d838a');
      const ribs=5;
      for(let i=0;i<ribs;i++) {
        const f=(i+.5)/ribs;
        block(0,0,wallH+Math.sin(Math.PI*f)*34*scale,w*(1/ribs),10*scale,d,'#5f666e');
      }
      block(0,-d*.48,wallH*.4,w*.7,wallH*.8,6,'#33383d');
      this.stampGlow('disc',x,y-d*.46,2,w*.62,4,w*.5,'#ffe9a8',rot,.35);
      return;
    }
    if(kind==='furnace_vent') {
      this.stamp('drum',x,y,16,30*scale,32*scale,30*scale,'#3d3330',rot);
      this.stamp('drum',x,y,34,20*scale,8*scale,20*scale,'#6e4a3a',rot);
      const flicker=.55+.4*Math.sin(this.animT*9+x);
      this.stampGlow('disc',x,y,40*scale,26*scale,10*scale,26*scale,'#ff7b2e',rot,flicker);
      return;
    }
    if(kind==='frost_pylon') {
      this.stamp('crown',x,y,scale*20,scale*26,scale*64,scale*26,'#a8d8e8',rot);
      this.stamp('crown',x,y,scale*52,scale*14,scale*22,scale*14,'#d7f4ff',rot);
      this.stampGlow('disc',x,y,3,34*scale,3,34*scale,'#7fd8ef',rot,.3);
      return;
    }
    if(kind==='snow_drift') { this.stamp('round',x,y,7,84*scale,14*scale,58*scale,'#e9f2f5',rot); return; }
    if(kind==='stone_bridge') {
      const length = prop.len ?? 270, width = prop.width ?? 80;
      part('block', 0, 0, 3, length, 6, width, '#9c9487');
      const slabs = Math.ceil(length / 15);
      for (let i = 0; i < slabs; i++) {
        part('block', ((i + .5) / slabs - .5) * length, 0, 6, length / slabs - .75, 1.5,
          width - 10, i % 2 ? '#b6ad9b' : '#c3b9a6');
      }
      for (const side of [-1, 1]) {
        part('block', 0, side * (width / 2 - 3), 9, length, 8, 5, '#897e71');
        part('block', 0, side * (width / 2 - 3), 13, length, 2, 6, '#cfc1aa');
      }
      return;
    }
    if(kind==='radar_station') {
      block(0,0,18,46*scale,36*scale,46*scale,'#5b626a');
      this.stamp('drum',x,y,44,7*scale,34*scale,7*scale,'#464d55',rot);
      const sweep=this.animT*1.4;
      this.stamp('block',x+Math.cos(sweep)*16,y+Math.sin(sweep)*16,66,34*scale,5*scale,26*scale,'#c9d4da',sweep);
      this.stampGlow('disc',x+Math.cos(sweep)*30,y+Math.sin(sweep)*30,66,16*scale,5,16*scale,'#7fd8ef',sweep,.5);
      return;
    }
    if(kind==='missile_rack') {
      block(0,0,10,40*scale,20*scale,30*scale,'#54595f');
      for(let i=0;i<3;i++)this.stamp('drum',x+(i-1)*11*scale,y,26,8*scale,26*scale,8*scale,'#6e7a4f',rot+Math.PI/12);
      return;
    }
    if(kind==='sandbag_wall') {
      for(let row=0;row<3;row++)for(let i=0;i<3-row%2;i++) {
        const dx=(i-(2-row%2-1)/2)*18*scale;
        block(dx,0,6+row*11*scale,20*scale,12*scale,13*scale,row%2?'#a08b62':'#967f56',rot);
      }
      return;
    }
    if(kind==='fuel_tank') {
      this.stamp('drum',x,y,26,34*scale,52*scale,34*scale,'#b8b04c',rot+Math.PI/2);
      block(-14*scale,0,6,6*scale,12*scale,30*scale,'#4a4d45');
      block(14*scale,0,6,6*scale,12*scale,30*scale,'#4a4d45');
      this.stamp('block',x,y,54,6*scale,5*scale,20*scale,'#8f2f2f',rot);
      return;
    }
    if(kind==='antenna_mast') {
      this.stamp('drum',x,y,44,4*scale,88*scale,4*scale,'#9aa0a8',rot);
      for(let i=1;i<=3;i++) {
        const z=18*i;
        block(0,0,z,34*scale-i*8*scale,3,4*scale,'#7e858d',rot);
        block(0,0,z,4*scale,3,34*scale-i*8*scale,'#7e858d',rot);
      }
      const blink=(Math.sin(this.animT*4+x)>0)?1:.15;
      this.stampGlow('round',x,y,92*scale,7,7,7,'#ff5a4a',rot,blink);
      return;
    }
    if(kind==='street_lamp') {
      this.stamp('drum',x,y,26,6*scale,52*scale,6*scale,'#5a6068',rot);
      block(6*scale,0,52*scale,16*scale,5*scale,4*scale,'#5a6068',rot);
      this.stampGlow('disc',x+10*scale,y,54*scale,15*scale,6,15*scale,'#ffe9a8',rot,.65);
      return;
    }
    if (kind === 'transport_plane') {
      const body = '#84908b', wing = '#737e77';
      this.stamp('round', x, y + 4, .45, 147 * scale, .7, 151 * scale, '#303b38', rot, this.actorAlpha * .34);
      part('cargoHull', 0, 0, 25, 1, .90, 1, body);
      part('cargoWing', 0, 0, 37, 1, 1, 1, wing);
      part('cargoTail', 0, 0, 35, 1, 1, 1, wing);
      part('cargoFin', 0, 0, 34, 1, 1, 1, '#64716b');
      part('round', 0, -65, 32, 22, 8, 18, '#3b5057');
      part('block', 0, -67, 36.3, 2, 1, 13, body);
      part('block', 0, 60, 20, 10, 2, 26, '#5f6d64', .29);
      for (const side of [-1, 1]) {
        for (const [dx, dy] of [[34, -19], [63, -16]]) {
          part('round', side * dx, dy, 33, 13, 13, 34, '#626f6b');
          part('drum', side * dx, dy - 18, 33, 7, 8, 7, '#425252', Math.PI / 2);
          part('block', side * dx, dy - 22, 33, 26, 2, 2, '#3b4546');
          part('block', side * dx, dy - 22, 33, 2, 26, 2, '#3b4546');
          part('block', side * dx + 12, dy - 22, 33, 3, 2, 2.5, '#b39a5e');
          part('block', side * dx - 12, dy - 22, 33, 3, 2, 2.5, '#b39a5e');
        }
        part('round', side * 14, 12, 15, 12, 13, 37, '#69746a');
        for (const dy of [9, 20]) part('drum', side * 13, dy, 5, 10, 5, 10, '#333a39', 0, Math.PI / 2);
        part('block', side * 83, -11, 38, 5, 2.5, 4, side === 1 ? '#4f826e' : '#9d4f41');
      }
      part('block', 0, -49, 8, 3, 12, 4, '#727971');
      part('drum', 0, -49, 4.5, 9, 5, 9, '#333a39', 0, Math.PI / 2);
      return;
    }
    if(kind==='parked_jeep') {
      const w=34*scale,l=58*scale;
      for(const side of [-1,1])for(const along of [-.3,.3]) {
        const wheel=side*w*.52, offset=along*l;
        this.stamp('drum',x+wheel*Math.cos(rot)-offset*Math.sin(rot),y+wheel*Math.sin(rot)+offset*Math.cos(rot),7,12*scale,10*scale,16*scale,'#2b2e30',rot);
      }
      block(0,0,15,w,14,l*.72,'#5d6b4f');
      block(0,-l*.08,25,w*.85,11,l*.3,'#3c4a3a');
      return;
    }
    if(kind==='ice_block'||kind==='ice_crystal') { this.stamp('crown',x,y,scale*15,scale*38,scale*50,scale*35,kind==='ice_block'?'#9bd1d8':'#c4f4f0',rot);return; }
    if(kind==='crate_stack') {
      for(let i=0;i<3;i++) {
        const dx=(i-1)*22, z=10+(i===1?18:0);
        block(dx,0,z,30,22,28,'#a9773c');
        for(const side of [-1,1])block(dx+side*12,0,z,3,24,30,'#59402a');
        block(dx,0,z+11,31,3,29,'#c49354');
        block(dx,0,z,31,3,30,'#c49354');
      }
      return;
    }
    if(kind==='hay_bale') {
      for(let i=0;i<3;i++)this.stamp('drum',x+(i-1)*23*scale,y,12+(i===1?20:0),24*scale,23*scale,29*scale,'#c2a455',Math.PI/2);
      for(let i=0;i<3;i++)block((i-1)*23,0,28,2,20,31,'#e1c46e');
      return;
    }
    if(kind==='wood_table'||kind==='wood_bench'||kind==='metal_workbench') {
      const color=kind==='metal_workbench'?'#697274':'#8f7049';
      block(0,0,17,52,7,31,color); for(const side of [-1,1])for(const along of [-1,1])block(side*21,along*11,7,4,15,4,'#514330');return;
    }
    if(kind==='duck_throne') { block(0,0,12,45,15,35,'#633b83');block(0,-17,30,47,40,10,'#7d4aa5');block(0,-23,54,35,9,6,'#edcc57');return; }
    if(kind==='ice_beacon') { this.stamp('drum',x,y,17,21*scale,37*scale,21*scale,'#7fc8dc',rot);this.stamp('crown',x,y,42*scale,16*scale,33*scale,16*scale,'#d7ffff',rot);return; }
    if(['billboard','vending_machine','bedside_cabinet','bed','table_field_kit','table_map_cup'].includes(kind)) {
      const color=kind==='vending_machine'?'#41695f':kind==='billboard'?'#855d3c':kind==='bed'?'#777c83':'#8b714d';
      block(0,0,15,kind==='bed'?56:37,kind==='bed'?9:29,kind==='bed'?78:30,color);
      if(kind==='bed')block(0,-24,22,53,9,24,'#ddd6c5');
      else if(kind==='vending_machine')block(0,-2,32,25,13,3,'#74bda0');
      else if(kind==='billboard')block(0,-8,35,32,17,3,'#d6bb77');
      else for(const side of [-1,1])block(side*12,0,5,3,11,3,'#504a3b');
      return;
    }
    if(kind==='crane'||kind==='bollard') {
      this.stamp('drum',x,y,28,kind==='crane'?20:9,54,kind==='crane'?20:9,'#bd9d54',rot);
      if(kind==='crane'){block(24,-9,47,66,8,8,'#c2a45a');block(51,-7,23,3,34,3,'#4a4b45');}
      return;
    }
    if (kind === 'palace_topiary') {
      part('drum', 0, 0, 3, 29, 6, 29, '#736b58');
      part('drum', 0, 0, 6.5, 26, 3, 26, '#a3977c');
      part('crown', 0, 0, 15, 28, 18, 27, '#344a3a');
      part('crown', 0, 0, 24, 23, 16, 23, '#53694c');
      part('crown', -3, -3, 30, 13, 11, 13, '#7c8864');
      return;
    }
    if (kind === 'berry_bush') {
      for (const [dx, dy, z, color] of [[-10,-5,12,'#41663d'], [10,-6,13,'#597940'],
        [-9,7,13,'#527a41'], [10,7,14,'#6c8b48'], [0,1,20,'#79994e']] as const) {
        part('crown', dx, dy, z, 22, 20, 21, color);
      }
      for (const [dx, dy, z] of [[-12,8,21], [-7,11,20], [2,3,29], [8,6,25], [13,8,22], [9,-9,21]]) {
        part('round', dx, dy, z, 5.5, 5.5, 5.5, '#bf5345');
      }
      return;
    }
    if(['thorn_bush','potted_flower'].includes(kind)) {
      for(let i=0;i<5;i++)this.stamp('crown',x+Math.cos(i*1.257)*14*scale,y+Math.sin(i*1.257)*11*scale,13+i%2*5,18*scale,17*scale,17*scale,kind==='thorn_bush'?'#46543b':kind==='potted_flower'?'#627f49':'#64854b',i);
      return;
    }
    const palettes:Record<string,string>={wood_chair:'#95754b',wood_bench:'#947249',bar_stool:'#805f40',stone_steps:'#817f76',wood_steps:'#98764c',duck_king_statue:'#b19c65',king_vault_gate:'#867352',lava_pool:'#e26e3d',lava_fissure:'#ed6f3c',ice_beacon:'#71b7d1'};
    const color=palettes[kind]??'#8e7955';
    this.stamp('crown',x,y,13,42*scale,23*scale,32*scale,color,rot);
  }

  private royalFlag(x: number, y: number, base: number, angle: number, scale: number, opacity: number) {
    const purple = '#683482', gold = '#e6bb59';
    const cloth = (shape: Shape, dx: number, dy: number, height: number, w: number, h: number,
      d: number, color: string, yaw = 0) => this.stamp(shape,
      x + scale * (dx * Math.cos(angle) - dy * Math.sin(angle)),
      y + scale * (dx * Math.sin(angle) + dy * Math.cos(angle)),
      base + height * scale, w * scale, h * scale, d * scale, color, angle + yaw, opacity);
    cloth('drum', 0, 0, 42, 3.5, 84, 3.5, '#685442');
    cloth('round', 0, 0, 85, 7, 7, 7, gold);
    const wave = (distance: number) => Math.sin(this.animT * 4 - distance * .18 + x * .018) * distance * .085;
    for (let i = 0; i < 7; i++) {
      const dx = 3 + i * 5;
      const dy = wave(dx);
      const slope = Math.atan2(wave(dx + 2.5) - wave(dx - 2.5), 5);
      const height = i >= 5 ? 22 - (i - 4) * 2.5 : 22;
      cloth('block', dx, dy, 67, 5.7, height, 1.25, purple, slope);
      for (const side of [-1, 1]) cloth('block', dx, dy, 67 + side * height / 2, 5.7, 1.8, 1.55, gold, slope);
    }
    for (const face of [-1, 1]) {
      const dy = wave(16) + face;
      cloth('round', 15, dy, 65, 12, 6, 1.1, gold);
      cloth('round', 19, dy, 70, 5.5, 6, 1.1, gold);
      cloth('block', 22, dy, 69, 3.5, 1.6, 1.1, '#f4a548');
      for (const dx of [17.8, 19.3, 20.8]) cloth('crown', dx, dy, 74, 1.8, 3, 1.2, gold);
    }
  }

  private castleRoof(floor: Floor, g: Game, x: number, y: number, inside: boolean) {
    if (inside) return;
    const width = floor.w + 36, depth = floor.h + 36;
    const purple = '#633779', shadow = '#412651', gold = '#d9ad54';
    const opacity = this.behindPlayer(g, x, y, width + 35, depth + 35, 176) ? .25 : 1;
    const part = (shape: Shape, dx: number, dy: number, z: number, w: number, h: number, d: number,
      color: string, angle = 0) => this.stamp(shape, x + dx, y + dy, z, w, h, d, color, angle, opacity);

    part('block', 0, 0, 77, width + 12, 20, depth + 12, shadow);
    part('block', 0, 0, 88, width + 20, 5, depth + 20, gold);
    part('block', 0, 0, 93, width - 9, 6, depth - 9, purple);
    for (const side of [-1, 1]) {
      for (let dx = -width / 2 + 54; dx < width / 2 - 39; dx += 42) {
        part('block', dx, side * depth / 2, 98, 22, 16, 14, purple);
        part('block', dx, side * depth / 2, 107, 24, 3, 15, gold);
      }
      for (let dy = -depth / 2 + 53; dy < depth / 2 - 37; dy += 42) {
        part('block', side * width / 2, dy, 98, 14, 16, 22, purple);
        part('block', side * width / 2, dy, 107, 15, 3, 24, gold);
      }
      for (const end of [-1, 1]) {
        const dx = side * (width / 2 - 29), dy = end * (depth / 2 - 29);
        part('drum', dx, dy, 97, 75, 78, 75, shadow);
        part('drum', dx, dy, 130, 80, 9, 80, gold);
        part('pine', dx, dy, 159, 81, 56, 81, purple);
        part('crown', dx, dy, 190, 11, 13, 11, '#f2cc6c');
      }
    }
    part('block', 0, 0, 120, 265, 52, 170, shadow);
    part('block', 0, 0, 148, 274, 6, 180, gold);
    part('roofLeft', 0, 0, 177, 274, 55, 180, '#7e4c96');
    part('roofRight', 0, 0, 177, 274, 55, 180, purple);
    part('gable', 0, 0, 177, 274, 55, 180, purple);
    part('block', 0, 0, 205, 7, 6, 180, gold);
    this.royalFlag(x, y - 10, 207, .06, 1.35, opacity);
    // Heraldic hangings flank the entrance and leave the door gap clear.
    for (const side of [-1, 1]) {
      const dx = side * 103, dy = depth / 2 + 3;
      part('block', dx, dy, 63, 41, 5, 5, gold);
      part('block', dx, dy, 45, 35, 31, 3, purple);
      part('block', dx, dy, 29, 35, 3, 3, gold);
      part('round', dx - 3, dy + 2, 43, 19, 9, 2, gold);
      part('round', dx + 4, dy + 2, 49, 8, 8, 2, gold);
      part('block', dx + 10, dy + 2, 48, 5, 2, 2, '#ed9e46');
      for (const tip of [-1, 0, 1]) part('crown', dx + 4 + tip * 2.6, dy + 2, 54, 3, 5, 2, gold);
    }
  }

  private roofRadar(x: number, y: number, roofHeight: number, opacity: number) {
    const angle = this.animT * 1.26;
    this.stamp('block', x, y, roofHeight + 3, 51, 12, 44, '#343f42', 0, opacity);
    this.stamp('drum', x, y, roofHeight + 12, 31, 13, 31, '#879da0', 0, opacity);
    this.stamp('drum', x, y, roofHeight + 23, 12, 19, 12, '#435a61', angle, opacity);
    const part = (dx: number, dy: number, height: number, w: number, h: number, d: number, color: string, pitch = 0) => {
      const c = Math.cos(angle), s = Math.sin(angle);
      this.stamp('block', x + dx * c - dy * s, y + dx * s + dy * c, roofHeight + height,
        w, h, d, color, angle, opacity, pitch);
    };
    // The reflector, cross braces and feed horn rotate together on the pedestal.
    for (let i = -3; i <= 3; i++) {
      const edge = Math.abs(i) === 3;
      part(i * 11, i * i * .9, 48, 3, edge ? 27 : 36, 4, '#b9d0c8', -.24);
    }
    for (const row of [-1, 0, 1]) {
      const height = 48 + row * 12;
      part(0, -row * 3, height, 68, row === 0 ? 3 : 4, 3, row === 0 ? '#6f9fa7' : '#e0ebdf');
    }
    part(0, 13, 48, 4, 5, 30, '#65777a');
    part(0, 25, 48, 10, 10, 8, '#90d2ce');
    const blink = (.28 + .65 * Math.max(0, Math.cos(this.animT * 4))) * opacity;
    this.stampGlow('round', x - 19, y + 13, roofHeight + 11, 6, 6, 6, '#f85d43', 0, blink);
  }

  private house(floor:Floor,g:Game) {
    if(!floor.roofed)return;
    const x = floor.x + floor.w / 2, y = floor.y + floor.h / 2;
    const p = g.player, art = BUILDING_ART[g.mapId];
    const inside = g.mode === 'raid' && p.x >= floor.x && p.x <= floor.x + floor.w
      && p.y >= floor.y && p.y <= floor.y + floor.h;
    if (g.mapId === 'mausoleum' && floor.name === '王座大厅') {
      this.castleRoof(floor, g, x, y, inside);
      return;
    }
    const overhang = g.mapId === 'mausoleum' ? 68 : 52;
    const roofWidth = floor.w + overhang, roofDepth = floor.h + overhang, eaves = 51;
    const span = roofWidth / 2, rise = Math.max(25, Math.min(115, roofWidth * art.rise));
    const ridgeHeight = eaves + rise;
    const isHangar = g.mapId === 'airbase' && floor.name.endsWith('机库');
    if (!inside) {
      const dx = Math.abs(p.x - x);
      const crossSection = Math.max(0, 1 - dx / span);
      const roofHeightAtPlayer = eaves + rise * (isHangar ? Math.sin(crossSection * Math.PI / 2) : crossSection);
      const coversPlayer = g.mode === 'raid' && dx < span + p.r
        && p.y < y + roofDepth / 2 - roofHeightAtPlayer + p.r * 2
        && p.y > y - roofDepth / 2 - roofHeightAtPlayer - p.r;
      const opacity = coversPlayer ? .25 : 1;
      const roofColor = floor.name === '红色谷仓' ? '#ae4c37' : art.roof;
      if (isHangar) {
        this.stamp('hangarRoof', x, y, eaves + rise / 2, roofWidth, rise, roofDepth, roofColor, 0, opacity);
        const ribs = 6;
        for (let i = 0; i <= ribs; i++) {
          const offset = (i / ribs - .5) * roofDepth * .95;
          this.stamp('hangarRoof', x, y + offset, eaves + rise / 2 + 1.5, roofWidth + 2, rise,
            5, art.trim, 0, opacity);
        }
      } else {
      this.stamp('roofLeft',x,y,eaves+rise/2,roofWidth,rise,roofDepth,roofColor,0,opacity);
      this.stamp('roofRight',x,y,eaves+rise/2,roofWidth,rise,roofDepth,art.shade,0,opacity);
      const slopeAngle = Math.atan2(rise, span);
      const bands = Math.max(3, Math.min(9, Math.round(span / 25)));
      for (const side of [-1, 1]) {
        for (let i = 1; i <= bands; i++) {
          const fraction = i / (bands + 1);
          this.stamp('block', x + side * span * fraction, y, eaves + rise * (1 - fraction) + 1.4,
            2.5, 2, roofDepth * .96, art.trim, 0, opacity, 0, side < 0 ? slopeAngle : -slopeAngle);
        }
        this.stamp('block', x + side * span, y, eaves, 8, 7, roofDepth + 5, art.fascia, 0, opacity);
        this.stamp('gable', x, y + side * (roofDepth / 2 - 3), eaves + rise / 2, roofWidth - 9, rise, 2, art.gable, 0, opacity);
        if (g.mapId === 'mausoleum') this.stamp('crown', x, y + side * roofDepth / 2, ridgeHeight + 6, 18, 22, 17, art.trim, 0, opacity);
      }
      this.stamp('block', x, y, ridgeHeight + 1, 9, 6, roofDepth + 7, art.trim, 0, opacity);
      }
      if (g.mapId === 'airbase' && floor.name === '冰封雷达站') {
        const offset = floor.w * .26;
        this.roofRadar(x + offset, y + floor.h * .23, eaves + rise * (1 - offset / span), opacity);
      }
    }
    if (g.training) return;
    const wallOffset = g.mapId === 'island' ? 0 : 18;
    const opacity = this.behindPlayer(g, x, y, floor.w + wallOffset * 2, floor.h + wallOffset * 2, 48) ? .25 : 1;
    const windowFrame = art.fascia;
    const windowTrim = art.trim;
    for(const end of [-1,1])for(const side of [-1,1]) {
      const wx=x+side*floor.w*.27, wy=y+end*(floor.h/2+wallOffset+2);
      this.stamp('block',wx,wy,32,34,22,5,'#293b43',0,opacity);
      this.stamp('block',wx,wy,32,4,25,7,windowFrame,0,opacity);
      this.stamp('block',wx,wy,32,35,3,7,windowTrim,0,opacity);
    }
    for(const side of [-1,1]) {
      const sx=x+side*(floor.w/2+wallOffset+2),sy=y+side*floor.h*.25;
      this.stamp('block',sx,sy,32,5,22,34,'#293b43',0,opacity);
      this.stamp('block',sx,sy,32,7,25,4,windowFrame,0,opacity);
      this.stamp('block',sx,sy,32,7,3,35,windowTrim,0,opacity);
    }
    if (g.mapId === 'island' && floor.name === '车站') this.trainStation(floor, g, ridgeHeight);
  }

  /** 鸭岛车站：站台、雨棚、长椅、站牌和楼前时钟，让火车站有明确的车站轮廓。 */
  private trainStation(floor: Floor, g: Game, roofTop: number) {
    const cx = floor.x + floor.w / 2;
    const south = floor.y + floor.h;
    const alpha = this.behindPlayer(g, cx, south + 30, floor.w + 60, 86, 88) ? .28 : 1;
    // Rooftop clock tower and station name board give the building a railway silhouette.
    const towerX = cx, towerY = floor.y + floor.h * .42;
    this.stamp('block', towerX, towerY, roofTop + 9, 28, 18, 28, '#3d514c', 0, alpha);
    this.stamp('block', towerX, towerY, roofTop + 21, 22, 10, 22, '#c7b67b', 0, alpha);
    this.stamp('drum', towerX, towerY, roofTop + 28, 20, 4, 20, '#2f3a3a', 0, alpha);
    this.stamp('drum', towerX, towerY, roofTop + 30, 16, 3, 16, '#f2e7c6', 0, alpha);
    this.stamp('block', towerX, towerY - 3, roofTop + 31.5, 2.5, 2, 7, '#313a38', 0, alpha);
    this.stamp('block', towerX + 3.5, towerY + 1, roofTop + 31.5, 7, 2, 2.5, '#313a38', 0, alpha);
    this.stamp('block', towerX, towerY + 13, roofTop + 15, 38, 8, 3, '#245a66', 0, alpha);
    this.stamp('block', towerX, towerY + 14, roofTop + 16, 28, 2.5, 3.5, '#f0d89a', 0, alpha);
    // Concrete platform and yellow safety line before the rails.
    this.stamp('block', cx, south + 28, 3, floor.w + 48, 6, 50, '#a49a80', 0, alpha);
    this.stamp('block', cx, south + 49, 6.6, floor.w + 42, 1.5, 3.5, '#e6c46d', 0, alpha);
    // Canopy posts and roof.
    for (const dx of [-.38, 0, .38]) for (const dy of [13, 41]) {
      this.stamp('block', cx + dx * floor.w, south + dy, 40, 7, 76, 7, '#4e5c55', 0, alpha);
      this.stamp('block', cx + dx * floor.w, south + dy, 78, 10, 4, 10, '#c2b080', 0, alpha);
    }
    this.stamp('block', cx, south + 27, 82, floor.w + 54, 7, 54, '#3f5b57', 0, alpha);
    this.stamp('block', cx, south + 27, 86, floor.w + 46, 2, 46, '#d9c589', 0, alpha);
    this.stamp('block', cx, south + 54, 80, floor.w + 44, 12, 3, '#245a66', 0, alpha);
    this.stamp('block', cx, south + 55, 81, floor.w * .34, 4, 4, '#f0d89a', 0, alpha);
    // Benches under the canopy.
    for (const dx of [-.28, .28]) {
      const bx = cx + dx * floor.w;
      this.stamp('block', bx, south + 24, 20, 46, 5, 16, '#9b7047', 0, alpha);
      this.stamp('block', bx, south + 29, 26, 46, 13, 3, '#b18455', 0, alpha);
      for (const side of [-1, 1]) this.stamp('block', bx + side * 18, south + 24, 10, 4, 20, 4, '#5c5142', 0, alpha);
    }
    // Platform lamps and a station clock on a post.
    for (const dx of [-.46, .46]) {
      const lx = cx + dx * floor.w;
      this.stamp('block', lx, south + 38, 58, 4, 116, 4, '#4b4f49', 0, alpha);
      this.stampGlow('round', lx, south + 38, 118, 14, 14, 14, '#ffe4a4', 0, alpha * .75);
    }
    const clockX = cx + floor.w * .52, clockY = south + 31;
    this.stamp('block', clockX, clockY, 70, 6, 140, 6, '#464d47', 0, alpha);
    this.stamp('drum', clockX, clockY, 142, 30, 4, 30, '#2f3a3a', 0, alpha);
    this.stamp('drum', clockX, clockY, 144, 25, 3, 25, '#f2e7c6', 0, alpha);
    this.stamp('block', clockX, clockY - 5, 145.5, 3, 2, 11, '#313a38', 0, alpha);
    this.stamp('block', clockX + 5, clockY + 2, 145.5, 10, 2, 3, '#313a38', 0, alpha);
    // A couple of luggage carts at the platform ends.
    for (const side of [-1, 1]) {
      const lx = cx + side * (floor.w * .42);
      this.stamp('block', lx, south + 12, 13, 30, 5, 18, '#6f6b5b', 0, alpha);
      this.stamp('block', lx, south + 12, 18, 24, 6, 14, '#8d7954', 0, alpha);
      for (const wx of [-9, 9]) this.stamp('drum', lx + wx, south + 12, 5, 8, 4, 8, '#343635', 0, alpha, Math.PI / 2);
    }
  }

  private corpseDuck(c:Game['containers'][number],alpha:number) {
    const r=Math.max(12,c.w/2),ca=Math.cos(c.angle),sa=Math.sin(c.angle);
    const [body,wing]=FEATHER_COLORS[c.etype??'chicken'];
    const point=(dx:number,dy:number)=>({x:c.x+dx*ca-dy*sa,y:c.y+dx*sa+dy*ca});
    const part=(shape:Shape,dx:number,dy:number,z:number,w:number,h:number,d:number,color:string,angle=c.angle)=>{
      const p=point(dx,dy); this.stamp(shape,p.x,p.y,z,w,h,d,color,angle,alpha);
    };
    this.stamp('round',c.x+2,c.y-2,.35,r*2.25,.5,r*1.52,'#454b3d',0,.24);
    part('round',-.12*r,0,3.2,r*2.02,4.6,r*1.4,body);
    part('round',-.12*r,-.47*r,4.2,r*1.25,3.2,r*.55,wing);
    part('round',-.12*r,.47*r,4.2,r*1.25,3.2,r*.55,wing);
    part('round',.69*r,0,5.1,r*.93,4.8,r*.9,body);
    part('crown',1.16*r,0,4.5,r*.44,3.3,r*.4,'#ec9639');
    for(const side of [-1,1]) {
      part('round',-1.05*r,side*.27*r,3.2,r*.42,2.2,r*.23,'#d88535');
      const eye=point(.69*r,side*.23*r),eyeSize=Math.max(4.5,r*.23);
      this.stamp('round',eye.x,eye.y,7.8,eyeSize,1.4,eyeSize,'#f6ebd4',0,alpha);
      this.stamp('block',eye.x,eye.y,9,eyeSize,1.7,1.6,'#302a26',c.angle+Math.PI/4,alpha);
      this.stamp('block',eye.x,eye.y,9,eyeSize,1.7,1.6,'#302a26',c.angle-Math.PI/4,alpha);
    }
    for(const side of [-1,1])part('round',-1.02*r,side*.25*r,5.2,r*.4,2,r*.28,wing);
    if (c.etype === 'hen') {
      // A few shared-palette feathers and a low comb keep the fallen thrower distinct.
      for (let i = -2; i <= 2; i++) {
        const fan = i / 2;
        part('crown', -1.3 * r - Math.abs(fan) * r * .04, fan * r * .39, 3.6,
          r * .54, 2.2, r * .25, i % 2 === 0 ? FEATHER_COLORS.hen[2] : body, c.angle + fan * .22);
      }
      part('round', .70 * r, 0, 8.0, r * .38, 1.6, r * .32, FEATHER_COLORS.hen[2]);
    }
  }

  private bird(x:number,y:number,r:number,angle:number,body:string,gear:string,armed:boolean,walk:number,boss:boolean,chicken:boolean,flash:boolean,roll:boolean,bossType?:Enemy['type']) {
    const ca=Math.cos(angle),sa=Math.sin(angle),bob=Math.sin(walk)*r*.075;
    const part=(shape:Shape,dx:number,dy:number,z:number,w:number,h:number,d:number,col:string,extraAngle=0) => {
      this.stamp(shape,x+r*(dx*ca-dy*sa),y+r*(dx*sa+dy*ca),Math.max(.2,(z+bob/r)*r)*(roll ? .65 : 1),w*r,h*r*(roll ? .72 : 1),d*r,col,angle+extraAngle);
    };
    /** 自发光部件（喷口火光、指示灯等），与 part 同一局部坐标系。 */
    const glow=(dx:number,dy:number,z:number,w:number,h:number,d:number,col:string,alpha=1) => {
      this.stampGlow('round',x+r*(dx*ca-dy*sa),y+r*(dx*sa+dy*ca),Math.max(.2,(z+bob/r)*r)*(roll ? .65 : 1),w*r,h*r,d*r,col,angle,alpha*this.actorAlpha);
    };
    this.stamp('round',x+2,y+3,.2,r*2.1,.9,r*1.55,'#676b50');
    const foot=Math.sin(walk)*.16;
    part('round',.1+foot,-.42,.12,.72,.24,.35,'#da893c');
    part('round',.1-foot,.42,.12,.72,.24,.35,'#da893c');
    const outfit = boss && bossType ? BOSS_OUTFITS[bossType] : undefined;
    part('round',-.04,0,.76 + Math.max(0, (outfit?.height ?? 1.42) - 1.55) / 2,
      outfit?.length ?? 1.98,outfit?.height ?? 1.42,outfit?.width ?? 1.53,outfit?.coat ?? body);
    for (const side of [-1, 1]) {
      part('round',-.43,side*(outfit ? outfit.width*.38 : .53),.79,1.02,.85,.46,outfit?.trim ?? gear);
    }
    part('round',.36,0,1.55,1.3,1.33,1.3,body);
    part('round',.99,0,1.43,.82,.31,.75,'#f49b37');
    if (bossType !== 'goose') {
      for(const side of [-1,1])part('round',.74,side*.46,1.72,.2,.22,.14,'#262d26');
    }
    if(chicken) {
      for(let i=0;i<3;i++)part('round',.05+i*.21,0,2.19,.28,.39,.22,'#d84e3d');
    } else if(boss) {
      // 每个 boss 独立的整套行头：头饰 + 身体衣物 + 背负装饰，不再共用"王冠"。
      if(bossType==='goose') {
        // 露出鹅头轮廓，宽版飞行员墨镜搭配单侧通讯耳机。
        part('block',.93,0,1.82,.13,.075,.61,'#232728');
        part('round',.19,-.59,1.77,.30,.37,.18,'#42433b');
        part('block',.13,-.60,2.01,.065,.43,.065,'#5d6958');
        for(const side of [-1,1]) {
          part('round',.90,side*.34,1.79,.28,.29,.43,'#171c21',-side*.25);
          part('block',1.01,side*.35,1.84,.055,.043,.22,'#6c7f79',-side*.25);
          part('block',.57,side*.44,1.80,.55,.07,.09,'#1a2027',side*.25);
          part('block',-.20,side*.68,1.27,.68,.14,.31,'#b18c46');
          part('block',.61,side*.24,1.09,.49,.18,.22,'#496246',side*.35);
          for(const dx of [.04,.34])part('drum',dx,side*.27,1.47,.115,.08,.115,'#b99045');
        }
        part('round',-1.02,0,.69,.55,1.06,1.48,'#253b31');
      } else if(bossType==='harborBoss') {
        // 海军船长帽：海蓝帽冠、深色前檐与黄铜锚徽。
        part('round',.24,0,2.16,1.40,.22,1.44,'#223746');
        part('round',.11,0,2.34,1.14,.55,1.31,'#49687a');
        part('round',.76,0,2.12,.63,.12,.99,'#293337');
        part('block',.66,0,2.37,.11,.28,.10,'#c7a462');
        part('block',.70,0,2.30,.10,.07,.29,'#c7a462');
        part('round',-.79,0,.83,1.16,1.21,1.92,'#234256');
        for(const side of [-1,1]) {
          part('block',.49,side*.36,1.34,.84,.21,.26,'#d1c3a2',side*.31);
          part('block',-.10,side*.99,1.17,.72,.22,.39,'#b99148');
          part('drum',.72,side*.29,1.37,.16,.1,.16,'#bd9549');
        }
        part('round',.40,.96,.91,1.28,.75,.62,'#32586d');
        part('block',1.09,1.04,1.02,.59,.28,.31,'#465862');
        part('block',1.36,.89,1.02,.28,.28,.61,'#91a1a1',.27);
        part('block',1.19,.68,1.02,.34,.25,.21,'#91a1a1',.42);
      } else if(bossType==='foundryBoss') {
        // 铜色铸造盔上的肋条和翻起的烟色护面罩。
        part('round',.18,0,2.09,1.42,.63,1.47,'#8b5d36');
        part('round',.36,0,2.03,1.50,.13,1.52,'#634438');
        part('round',.18,0,2.37,.91,.15,.19,'#bb864c');
        part('block',.79,0,2.19,.23,.32,.97,'#4a4240');
        part('block',.91,0,2.24,.05,.09,.74,'#815f46');
        part('block',.98,0,.82,.34,1.29,1.44,'#915f3e');
        part('block',1.17,0,.75,.07,.86,1.15,'#aa6f45');
        part('block',-.84,0,1.46,1.14,1.02,1.62,'#4c3d35');
        const ember=.5+.5*Math.sin(this.animT*6);
        for(const side of [-1,1]) {
          const stackHeight = side < 0 ? 2.56 : 2.25;
          part('block',-.12,side*1.04,1.16,.93,.64,.49,'#614236');
          part('drum',-.95,side*.51,stackHeight-.50,.44,1.04,.44,'#62534c');
          part('drum',-.95,side*.51,stackHeight,.56,.16,.56,'#3b312d');
          part('drum',-.95,side*.51,stackHeight+.09,.34,.025,.34,'#282122');
          glow(-.95,side*.51,stackHeight+.10,.17,.06,.17,'#d95a28',.30+ember*.28);
        }
      } else if(bossType==='broodQueen') {
        // 孵巢鸭后：金冠、叶绿围披和大型藤编蛋篮。
        part('round',.21,0,2.13,1.33,.22,1.40,'#615037');
        for (const side of [-1,1]) {
          part('round',.12,side*.43,2.27,.71,.21,.33,'#748354',side*.35);
          part('round',.50,side*.34,2.22,.44,.16,.21,'#939d5e',-side*.52);
        }
        part('drum',.29,0,2.29,.82,.15,.80,'#b98030');
        part('drum',.29,0,2.39,.76,.15,.75,'#efd070');
        for (let point = 0; point < 5; point++) {
          const tip = point * (Math.PI * 2 / 5);
          part('crown',.29+Math.cos(tip)*.29,Math.sin(tip)*.29,point===0?2.64:2.57,
            .23,point===0?.49:.37,.23,'#ffdb76');
        }
        part('crown',.62,0,2.52,.13,.18,.16,'#4c8e6c');
        for(const side of [-1,1])part('crown',-.35,side*.8,1.2,.76,1.1,.55,'#b3c678');
        part('round',-.82,0,1.16,1.14,.79,1.39,'#765637');
        part('drum',-.84,0,1.52,1.13,.12,1.38,'#aa8051');
        for (const [dx,dy] of [[-.56,0],[-.96,-.34],[-.96,.34]]) {
          part('round',dx,dy,1.65,.42,.57,.40,'#d7c38a');
        }
        for(const side of [-1,1])part('drum',-.1,side*.7,.75,.6,.42,.5,'#b3c678');
      } else if(bossType==='frostMarshal') {
        // 霜羽元帅：冰晶军帽 + 白色披风 + 冰蓝肩甲。
        part('round',.12,0,2.10,1.37,.62,1.46,'#425c76');
        for (const side of [-1,1]) part('round',.12,side*.58,1.86,.44,.55,.24,'#a4b4b5');
        part('block',.72,0,2.18,.19,.22,.96,'#557686');
        part('crown',.77,0,2.38,.24,.39,.30,'#8dbbc9');
        for (const side of [-1,1]) part('crown',.61,side*.21,2.32,.22,.25,.21,'#6a9bb0');
        part('round',-.91,0,.91,.78,1.42,1.60,'#9fbec4');
        part('block',.47,0,1.14,.78,.17,1.28,'#546c80');
        part('crown',-.65,-.56,1.55,.40,.68,.38,'#73adbd');
        part('crown',-.65,.56,1.55,.40,.68,.38,'#73adbd');
        for(const side of [-1,1])part('drum',-.2,side*.78,.9,.5,.36,.5,'#3d7791');
        for(const side of [-1,1])part('crown',-.2,side*.78,1.14,.32,.22,.32,'#d9f7ff');
      } else if(bossType==='ironGuard') {
        // 铁壁统领：黑红重甲全套——头盔、巨型肩甲、正面撞角、红色目镜缝。
        part('round',.15,0,2.02,1.39,.71,1.41,'#514547');
        part('block',.61,0,2.17,.71,.18,1.22,'#6c5050');
        part('block',.91,0,1.81,.21,.36,.99,'#2c2625');
        part('block',1.03,0,1.89,.07,.10,.74,'#b17d39');
        for (const side of [-1,1]) part('block',.51,side*.57,1.68,.51,.45,.24,'#675251');
        for(const side of [-1,1])part('drum',-.3,side*.85,1.0,.62,.6,.62,'#1a1013');
        for(const side of [-1,1])part('crown',-.3,side*.85,1.36,.4,.28,.4,'#3a1216');
        part('block',-.36,0,.92,.66,1.2,1.52,'#2d0d12');
        part('block',.68,0,.81,.66,1.25,1.65,'#782e31');
        for(const side of [-1,1]) {
          part('block',.09,side*.84,1.25,1.17,.47,.53,'#4a3035');
          part('block',.35,side*.89,1.50,.58,.12,.43,'#a04438');
        }
      } else if(bossType==='duckKing') {
        // 鸭王：金冠 + 紫色披风 + 金权杖（权杖顶端发光宝石）。
        part('round',.22,0,2.29,.95,.51,1.01,'#723642');
        part('drum',.24,0,2.17,1.13,.17,1.13,'#be9048');
        for (let i=0;i<5;i++) {
          const a=i*Math.PI*2/5;
          part('crown',.24+Math.cos(a)*.43,Math.sin(a)*.43,2.38,.24,.44,.24,'#cfa654');
        }
        part('crown',.65,0,2.34,.17,.24,.17,'#983e41');
        part('block',-.5,0,1.05,.2,1.15,1.5,'#693a83');
        part('block',-.68,0,.7,.16,.75,1.0,'#8a5eb2');
        part('block',.83,0,1.18,.15,2.1,.15,'#8a5eb2');
        part('round',.83,0,2.22,.45,.4,.45,'#e8c34e');
        glow(.83,0,2.34,.5,.4,.5,'#c9a4ff',.55);
        part('round',-.48,0,.86,.82,.64,1.42,'#693a83');
        for(const side of [-1,1])part('drum',-.2,side*.78,.9,.44,.34,.44,'#4a2a5e');
      } else if(bossType==='flameAce') {
        // 烈焰王牌：飞行帽+风镜+围巾+救生背心，背负双喷气引擎（喷口喷火）。
        part('round',.18,0,2.10,1.26,.60,1.30,'#654b40');
        part('block',.77,0,2.16,.12,.10,.81,'#5b4436');
        for (const side of [-1,1]) {
          part('round',.14,side*.56,1.82,.42,.47,.23,'#895f41');
          part('round',.73,side*.35,2.18,.41,.34,.43,'#aa8552');
          part('round',.88,side*.36,2.19,.16,.26,.31,'#d29544');
        }
        part('drum',-.08,0,2.1,.98,.3,.92,'#e05a2c');
        part('block',-.62,0,1.72,.18,.72,1.0,'#ff8a3c');
        part('block',-.98,-.14,1.5,.14,.5,.6,'#ff9c4a');
        for(const side of [-1,1])part('round',-.22,side*.62,1.0,.78,.5,.5,'#ff8a3c');
        part('round',-.22,0,1.12,1.0,.36,.9,'#d94f2a');
        // 喷气背包：背后两只短舱 + 底部喷口火光（随时间闪烁）。
        for(const side of [-1,1]) {
          part('drum',-.81,side*.57,1.27,.52,1.05,.52,'#555050');
          part('drum',-.81,side*.57,.72,.45,.20,.45,'#2f2929');
          part('drum',-.81,side*.57,.61,.29,.06,.29,'#a75232');
        }
        const jet=.55+.45*Math.sin(this.animT*13);
        for(const side of [-1,1])glow(-.81,side*.57,.43,.24,.30+jet*.18,.24,'#df6529',.42+jet*.26);
      } else if(bossType==='radarWarden') {
        // 冰霜雷达官：兜帽+雪镜+背负旋转雷达碟 + 肩部小炮台，蓝白制服。
        part('round',.10,0,1.99,1.32,.86,1.39,'#41677a');
        for (const side of [-1,1]) part('round',.49,side*.54,1.86,.63,.42,.24,'#b4b8a8');
        part('block',.77,0,1.90,.31,.32,1.07,'#2c4353');
        part('round',.92,0,1.92,.23,.25,.92,'#609baa');
        part('block',.26,-.60,2.19,.09,.52,.09,'#688491');
        const sweep=this.animT*2.2;
        part('block',-.85,0,1.17,.74,.83,1.17,'#294854');
        part('drum',-.97,0,1.66,.31,.34,.31,'#557b8e');
        part('block',-.97,0,1.91,.74,.24,.22,'#6b9aa7',sweep);
        part('block',-.97,0,2.03,.55,.06,.14,'#45859a',sweep);
        part('drum',-.3,0,.9,1.15,.5,1.05,'#2f5f78');
        // 肩部小炮台：基座 + 指向朝向的短炮管。
        part('drum',-.29,.74,1.41,.53,.33,.53,'#4a5663');
        part('block',-.25,.74,1.59,.56,.28,.43,'#485866');
        for (const side of [-1,1])part('block',.12,.74+side*.11,1.62,.67,.12,.13,'#34424d');
      }
    } else {
      if (bossType !== 'hen') {
        part('round',.28,0,2.05,1.27,.42,1.24,gear);
        part('block',.61,0,2.01,.93,.1,1.04,gear);
      }
      // 杂兵外观特征：一眼读出兵种。
      if(bossType==='armored') {
        part('drum',.3,0,2.55,1.0,.36,.94,'#59435b');
        part('round',.3,0,2.82,.6,.28,.6,'#48414e');
        for(const side of [-1,1])part('block',-.2,side*.85,1.3,.5,.6,.7,'#3c3440');
        part('block',-.68,0,1.23,.69,.73,1.08,'#514650');
        part('block',.65,0,.78,.53,.76,1.22,'#655762');
        for (const side of [-1,1]) part('block',.20,side*.70,1.09,.71,.38,.22,'#7b6a6c');
      } else if(bossType==='lookout') {
        part('block',.62,0,2.5,.85,.26,.4,'#3a3f45');
        part('round',.86,0,2.52,.22,.18,.22,'#9fe6ff');
        part('drum',-.55,0,1.35,.1,1.0,.1,'#5b6670',Math.PI/2);
        part('round',-.55,0,1.95,.22,.22,.22,'#ff5a4a');
      } else if(bossType==='shield') {
        part('block',1.14,-.41,1.03,.21,1.97,1.59,'#394754');
        part('block',1.27,-.41,1.05,.09,1.68,1.32,'#587e92');
        part('block',1.34,-.41,1.62,.095,.20,1.08,'#22323e');
        for (const side of [-1,1]) {
          part('block',1.35,-.41+side*.54,.43,.09,.27,.12,'#cdb174');
          part('round',-.28,side*.73,1.04,.81,.5,.41,'#626e79');
        }
        part('block',-.58,0,1.17,.69,.63,1.02,'#415363');
        part('drum',.3,0,2.5,.9,.3,.85,'#3f4a57');
      } else if(bossType==='elite') {
        part('drum',.28,0,2.56,.9,.3,.8,'#24282c',Math.PI/2);
        part('crown',.28,0,2.74,.3,.26,.3,'#d64545');
        part('block',-.4,0,1.6,.14,.7,1.5,'#c23b3b');
        part('block',-.79,0,1.16,.80,.67,.94,'#393638');
        part('block',-.93,-.33,1.77,.08,.79,.08,'#787467');
        part('round',-.93,-.33,2.17,.13,.15,.13,'#ad5540');
        part('block',.51,0,.91,.42,.62,1.11,'#515052');
        for (const side of [-1,1]) {
          part('block',.55,side*.27,1.15,.39,.31,.25,'#746a53');
          part('block',-.39,side*.67,.69,.51,.49,.26,'#47454a');
        }
      } else if(bossType==='hen') {
        // 投弹母鸡保留蛋囊和胸雷；短鸡冠、肉髯、扇尾和分层橙翅强化禽类轮廓。
        const henAccent=FEATHER_COLORS.hen[2];
        part('round',.52,0,.93,1.16,1.02,1.14,gear);
        part('round',.12,0,1.88,.42,.75,1.26,body);
        part('round',-.08,-.51,1.99,.37,.23,.30,body);
        part('round',-1.03,0,1.0,.48,.34,.46,body);
        for(let i=-2;i<=2;i++) {
          const fan=i/2;
          part('crown',-1.34-Math.abs(fan)*.05,fan*.40,1.05,.62,.34,.31,
            i%2===0?henAccent:body,fan*.24);
        }
        part('drum',-.56,0,1.33,.76,.26,.91,'#885732');
        for(const side of [-1,1])part('round',-.57,side*.23,1.50,.34,.42,.3,'#f7f3ea');
        part('round',.15,0,1.05,.34,.4,.3,'#33383c');
        part('round',.15,0,.82,.12,.14,.12,'#e8b13b');
        // Three low comb lobes sit on the crown rather than forming a tall cap.
        part('round',.29,0,2.23,.42,.18,.28,henAccent);
        for(const dx of [.12,.31,.49])part('crown',dx,0,2.34,.18,.16,.18,henAccent);
        // The small wattle hangs below the beak, clear of the face.
        part('round',1.04,0,1.14,.18,.36,.19,henAccent);
        part('round',1.08,0,1.00,.20,.20,.20,henAccent);
        // Three orange feather plates layer over each existing orange wing.
        for(const side of [-1,1]) {
          for(let i=0;i<3;i++) {
            const dx=-.72+i*.20;
            part('crown',dx,side*(.76+(1-i)*.035),.80,.38,.25,.22,
              i===1?gear:henAccent,side*.16);
          }
        }
      } else if(bossType==='bandit') {
        part('block',.3,0,2.5,.95,.24,.9,'#2f7d4f');
        part('block',-.35,0,1.75,.14,.6,1.3,'#d64545');
      }
    }
    if(armed) {
      part('block',.68,.56,.86,1.22,.3,.26,'#414b47');
      part('block',1.35,.56,.87,.47,.14,.15,'#2e3739');
      if(flash)part('crown',1.74,.56,.88,.7,.6,.55,'#ffdc66');
    }
  }

  private burningGround(f: FireZone) {
    const fade = Math.min(1, Math.max(.18, (f.t + .12) / .25), Math.max(0, (f.dur - f.t) / .8));
    if (fade <= 0) return;
    const seed = f.x * .041 + f.y * .063;
    this.stamp('groundPatch', f.x, f.y, .9, f.r * 2, 1, f.r * 2, '#372622', seed, fade * .49);
    this.stamp('ring', f.x, f.y, 1.5, f.r * 2, 2.5, f.r * 2, '#ac6c3c', 0, fade * (f.hostile ? .30 : .18));
    const count = Math.max(9, Math.min(17, Math.round(f.r / 7)));
    for (let i = 0; i < count; i++) {
      const angle = seed + i * 2.39996;
      const radius = Math.sqrt((i + .5) / count) * f.r * .8;
      const x = f.x + Math.cos(angle) * radius, y = f.y + Math.sin(angle) * radius;
      const phase = this.animT * (2.1 + i % 3 * .27) + i * 1.73 + seed;
      const flicker = .68 + .19 * Math.sin(phase * 4) + .13 * Math.sin(phase * 7.3);
      const width = (9 + i % 4 * 2) * (.74 + fade * .26);
      const height = (31 + i % 5 * 7) * flicker * (.68 + fade * .32);
      const direction = .32 * Math.sin(phase * 1.4) + .4;
      this.stamp('flame', x, y, 2 + height / 2, width, height, width * .76, i % 3 ? '#ed4d1d' : '#ed6824',
        direction, fade * .92, -.12);
      this.stampGlow('flame', x + 1.1, y + 2, 2 + height * .29, width * .63, height * .57, width * .60, '#ffbe58',
        direction, fade * .75);
      if (i % 3 !== 0) continue;
      const ash = phase * .22 - Math.floor(phase * .22);
      this.stamp('round', x + ash * 27, y + ash * 14, 26 + ash * 58,
        12 + ash * 26, 12 + ash * 19, 12 + ash * 22, '#473c3b', direction, (1 - ash) * fade * .58);
      const ember = phase * .67 - Math.floor(phase * .67);
      this.stampGlow('crown', x + ember * 18, y - ember * 6, 8 + ember * 43,
        2.3, 5 - ember * 3, 2.3, '#ffb455', 0, fade * (1 - ember) * .85);
    }
  }

  render(g: Game) {
    if(g.map!==this.map) {
      this.removeTerrain(); this.map=g.map; this.terrain=createTerrain(g); this.scene.add(this.terrain);
      this.scene.background = new THREE.Color(SCENE_BG[g.mapId] ?? SCENE_BG.island);
    }
    this.animT = g.realT;
    const center=this.screenToWorld(g,this.width/2,this.height/2);
    const hw=this.width/(2*g.cam.zoom),hh=this.height/(2*g.cam.zoom);
    Object.assign(this.camera,{left:-hw,right:hw,top:hh,bottom:-hh});
    this.camera.position.set(center.x,2600,center.y+2600); this.camera.lookAt(center.x,0,center.y); this.camera.updateProjectionMatrix();
    for (const batch of this.batches.values()) batch.used = 0;
    // Glow instances are rebuilt each frame, just like opaque scenery and actors.
    // Keeping the last frame's count leaves old lights behind when a boss moves.
    for (const batch of this.glowBatches.values()) batch.used = 0;
    const visible=(x:number,y:number,margin=100)=>Math.abs(x-center.x)<hw+margin && Math.abs(y-center.y)<hh/tilt+margin;
    for(const s of g.map.solids)if(visible(s.x,s.y,Math.max(s.w,s.h)+100))this.cover(s,g);
    for(const floor of g.map.floors)if(visible(floor.x+floor.w/2,floor.y+floor.h/2,Math.max(floor.w,floor.h)))this.house(floor,g);
    for(const prop of g.map.props)if(visible(prop.x,prop.y,120)) {
      this.actorAlpha=this.behindPlayer(g,prop.x,prop.y,100*prop.scale,100*prop.scale,70) ? .22 : 1;
      this.lowPolyProp(prop); this.actorAlpha=1;
    }
    for(const pad of g.map.pads)if(pad.type==='field'&&visible(pad.x,pad.y,Math.max(pad.w,pad.h))) {
      for(let row=0;row<Math.floor(pad.h/32);row++) {
        const y=pad.y-pad.h/2+18+row*32;
        this.stamp('block',pad.x,y,2,pad.w-12,3,7,row%2?'#80643d':'#705939');
        for(let column=0;column<Math.floor(pad.w/30);column++) {
          const x=pad.x-pad.w/2+18+column*30;
          this.stamp('crown',x,y,11+(column%3)*2,10,18+(column%2)*5,10,column%4===0?'#8f9a48':'#a3a64c');
        }
      }
    }
    for(const t of g.map.trees) {
      if(!visible(t.x,t.y,t.r*4))continue;
      this.stamp('round',t.x+t.r*.15,t.y-t.r*.18,.4,t.r*1.85,.5,t.r*1.65,'#3c513a',0,.25);
      const clear=g.mode==='raid' && Math.abs(t.x-g.player.x)<t.r+12 && t.y>=g.player.y-t.r && t.y-g.player.y<3*t.r;
      if (g.mapId === 'hatchery') {
        const { x, y, r, v } = t;
        this.stamp('drum', x, y, r*.66, r*.48, r*1.32, r*.48, '#5d4634', 0, clear ? .18 : 1);
        if (clear) continue;
        const angle = v * 2.1 + x * .03;
        for (const [offset, height, width, color] of [[0,1.74,1.7,'#536d40'],
          [-.51,1.4,1.29,'#48603b'], [.53,1.64,1.35,'#64804a']] as const) {
          this.stamp('crown', x + Math.cos(angle)*r*offset, y + Math.sin(angle)*r*offset,
            r*height, r*width, r*1.3, r*width*.85, color, angle);
        }
        this.stamp('crown', x-r*.12, y-r*.14, r*2.07, r*1.08, r*.74, r*.98, '#829359', angle);
        continue;
      }
      if (g.mapId === 'mausoleum') {
        const { x, y, r, v } = t;
        this.stamp('drum', x, y, r*.42, r*.46, r*.84, r*.46, '#53463a', 0, clear ? .18 : 1);
        if (clear) continue;
        this.stamp('pine', x, y, r*1.22, r*1.54, r*1.6, r*1.54, '#314d42', v);
        this.stamp('pine', x, y, r*1.88, r*1.23, r*1.55, r*1.23, '#446755', v+.2);
        this.stamp('pine', x, y, r*2.48, r*.89, r*1.5, r*.89, '#5f7c64', v+.4);
        continue;
      }
      this.stamp('drum',t.x,t.y,t.r*.66,t.r*.38,t.r*1.32,t.r*.38,'#675541',0,clear ? .18 : 1);
      if(clear)continue;
      this.stamp('crown',t.x,t.y,t.r*1.85,t.r*2.2,t.r*2.3,t.r*2.1,g.mapId==='outpost'?'#c6dbd8':'#527550',t.v);
      this.stamp('crown',t.x-t.r*.28,t.y-t.r*.14,t.r*2.35,t.r*1.45,t.r*1.5,t.r*1.4,g.mapId==='outpost'?'#e7eeeb':'#799566',t.v+.8);
    }
    for(const e of g.extracts) {
      this.stamp('ring',e.x,e.y,1,e.r*2,6,e.r*2,'#79f6aa');
      const pulse=.45+.48*((g.realT*.65)%1);
      this.stamp('ring',e.x,e.y,1.25,e.r*2*pulse,4,e.r*2*pulse,'#b5ffce');
    }
    // --- 空军基地首领的地面预警：航线、落点、地雷与冰墙 ---
    for(const e of g.enemies) {
      if(e.dead||e.special!=='newWind')continue;
      const enc=e.def.encounter;
      const phase=enc?.phases[e.skillPhase];
      const progress=phase&&phase.windup>0?1-e.specialT/phase.windup:0;
      if(e.castSkill==='strafe'||e.castSkill==='napalm') {
        for(const line of e.lines) {
          const len=Math.hypot(line.x1-line.x0,line.y1-line.y0);
          const ang=Math.atan2(line.y1-line.y0,line.x1-line.x0);
          const mx=(line.x0+line.x1)/2,my=(line.y0+line.y1)/2;
          const color=e.castSkill==='strafe'?'#ff5a4a':'#ff8a3c';
          this.stamp('block',mx,my,1.2,len,.8,line.w,color,ang,.22);
          const sweep=(g.realT*2.4)%1;
          const hx=line.x0+(line.x1-line.x0)*sweep,hy=line.y0+(line.y1-line.y0)*sweep;
          this.stampGlow('groundPatch',hx,hy,2,line.w*1.1,1,line.w*1.1,color,ang,.36);
        }
      }
      if(e.castSkill==='scan') {
        // 雷达扇形随蓄力扫过，蓝线扫到谁谁被锁定。
        const beamA=e.scanA+progress*2.4;
        const range=e.scanR;
        for(let k=0;k<3;k++) {
          const a=beamA-k*.05;
          this.stampGlow('block',e.x+Math.cos(a)*range/2,e.y+Math.sin(a)*range/2,3,range,4+k*3,4+k*3,'#4ad1ff',a,.42-k*.12);
        }
        this.stampGlow('disc',e.x,e.y,4,46,8,46,'#7fd8ef',beamA,.5);
      }
      if(e.castSkill==='icewall') {
        for(const line of e.lines) {
          const len=Math.hypot(line.x1-line.x0,line.y1-line.y0);
          const ang=Math.atan2(line.y1-line.y0,line.x1-line.x0);
          this.stamp('block',(line.x0+line.x1)/2,(line.y0+line.y1)/2,10,len,line.w,line.w,'#a8e4f5',ang,.3);
        }
      }
      for(const mark of e.marks) {
        const pulse=.5+.5*Math.sin(g.realT*9+mark.x);
        this.stamp('ring',mark.x,mark.y,1.2,60,4,60,mark.mine?'#9fe6ff':'#ffb37a',0,.55);
        this.stampGlow('disc',mark.x,mark.y,1.4,40+pulse*10,5,40+pulse*10,mark.mine?'#4ad1ff':'#ff9c61',0,.32+pulse*.2);
      }
    }
    for(const w of g.icewalls) {
      if(w.dead)continue;
      const h=Math.max(30,w.hp*.55);
      this.stamp('crown',w.x,w.y,h*.6,w.r*2.4,h*1.6,w.r*2.4,'#bfe8f5',w.x*.37,.85);
      this.stamp('crown',w.x,w.y,h*1.05,w.r*1.5,h*.7,w.r*1.5,'#e8f8ff',w.x*.37+.6,.9);
      this.stamp('ring',w.x,w.y,1,w.r*2.6,3,w.r*2.6,'#d7f4ff',0,.4);
    }
    for(const m of g.mines) {
      const armed=m.arm<=0;
      const pulse=armed?.5+.5*Math.sin(g.realT*8+m.x):.25;
      this.stamp('drum',m.x,m.y,6,16,10,16,'#4d6a78');
      this.stampGlow('disc',m.x,m.y,1.6,m.r*2*(0.9+pulse*.2),5,m.r*2*(0.9+pulse*.2),armed?'#4ad1ff':'#7fd8ef',0,armed?.34+pulse*.22:.18);
    }
    for(const c of g.containers) {
      if(!visible(c.x,c.y))continue;
      if(c.body) {
        this.corpseDuck(c,1);
        if(g.nearC===c)this.stamp('ring',c.x,c.y,1,c.w+14,4,c.h+14,'#ffdd74');
        continue;
      }
      const h=Math.min(28,c.h*.65);
      this.actorAlpha = this.behindPlayer(g, c.x, c.y, c.w, c.h, h + 12) ? .25 : 1;
      this.stamp('round',c.x+2,c.y-2,.5,c.w*1.36,.6,c.h*1.32,'#515441',0,.38);
      if(c.type==='treasure_chest') {
        const w = c.w, d = c.h, lift = c.open > 0 ? 1.16 : 0;
        const lidY = c.y - d / 2 + Math.cos(lift) * d / 2;
        const lidZ = h * .71 + Math.sin(lift) * d / 2 + 4;
        this.stamp('block', c.x, c.y, h * .35, w, h * .7, d, '#81502c');
        this.stamp('block', c.x, c.y, h * .71, w - 4, 2, d - 4, '#4e3222');
        this.stamp('chestLid', c.x, lidY, lidZ, w, 11, d, '#ae753c', 0, this.actorAlpha, -lift);
        for (const side of [-1, 1]) {
          this.stamp('chestLid', c.x + side * w * .29, lidY, lidZ, 3, 11.8, d + 1, '#dfb74f', 0, this.actorAlpha, -lift);
          this.stamp('block', c.x + side * w * .29, c.y + d / 2, h * .37, 3, h * .73, 1.8, '#dfb74f');
        }
        this.stamp('block', c.x, c.y + d / 2, h * .67, 8, 8, 3, '#e7c66d');
        this.stamp('block', c.x, c.y + d / 2 + 2, h * .67, 2, 3, 1, '#624622');
      } else if(c.type==='safe') {
        // 保险箱：墨绿铁箱 + 前面板转盘。
        this.stamp('block',c.x,c.y,h*.55,c.w,h,c.h,'#3c4640');
        this.stamp('block',c.x,c.y,h+1,c.w+1.5,3,c.h,'#556057');
        this.stamp('drum',c.x+c.w*.26,c.y,h*.55,6,h*.55,c.h*.6,'#2c342f',Math.PI/2);
        this.stamp('drum',c.x-c.w*.26,c.y,h*.55,4,h*.4,c.h*.45,'#8d968c',Math.PI/2);
        if(g.nearC===c)this.stampGlow('disc',c.x,c.y,1.5,c.w*1.4,4,c.h*1.4,'#9fe6ff',0,.3);
      } else if(c.type==='coin_pile') {
        const piles = [[-.29, .14, 3], [.02, .29, 4], [.31, .08, 2], [-.17, -.22, 2], [.19, -.28, 3], [.02, -.01, 5]];
        for (const [dx, dy, count] of piles) {
          const px = c.x + dx * c.w, py = c.y + dy * c.h;
          const remaining = c.open > 0 ? Math.min(count, 1) : count;
          for (let coin = 0; coin < remaining; coin++) {
            this.stamp('drum', px + coin % 2, py, 1 + coin * 2, 9, 2, 9, coin % 2 ? '#b57921' : '#edb840');
          }
          this.stamp('drum', px, py, remaining * 2 + .2, 7, .8, 7, '#f8d866');
        }
      } else if(c.type==='vending') {
        // 贩卖机本体即容器：机身 + 发光橱窗。
        this.stamp('block',c.x,c.y,29,c.w,58,c.h,'#41695f');
        this.stamp('block',c.x,c.y-4,40,c.w*.62,26,3,'#74bda0');
        this.stampGlow('disc',c.x,c.y-4.5,40,c.w*.5,6,14,'#b8ffe0',0,.3);
      } else if(c.type==='pc'||c.type==='desktop'||c.type==='laptop') {
        // 电子设备搜索点：近黑的机身 + 发光屏幕，和木箱拉开差距。
        if(c.type==='pc') {
          // 立式机箱：窄高黑塔，正面散热栅格 + 电源指示灯。
          this.stamp('block',c.x,c.y,h*.62,c.w*.8,h*1.15,c.h*.92,'#1f2428');
          this.stamp('block',c.x,c.y,h*.62+c.h*.55,c.w*.7,2,c.h*.1,'#2c343a');
          for(const zz of [.2,.42,.64])this.stamp('block',c.x+c.w*.12,c.y-c.h*.18,h*1.15*zz+2,c.w*.5,1.2,2,'#12161a');
          this.stampGlow('disc',c.x-c.w*.2,c.y-c.h*.3,h*1.15,3.5,3.5,3.5,'#6dff9e',0,.8);
        } else if(c.type==='desktop') {
          // 台式电脑：竖立的发光显示器 + 前置键盘。
          this.stamp('block',c.x,c.y-c.h*.28,h*.55,c.w*.9,h*.85,c.h*.28,'#1f2428');
          this.stamp('block',c.x,c.y-c.h*.28,h*.68,c.w*.72,h*.6,2,'#79cfe8');
          this.stampGlow('disc',c.x,c.y-c.h*.3,h*.72,c.w*.62,6,c.h*.2,'#9fe6ff',0,.5);
          this.stamp('block',c.x,c.y+c.h*.3,h*.3,c.w*.86,2.5,c.h*.32,'#3a4147');
          this.stamp('block',c.x,c.y+c.h*.3,h*.36,c.w*.6,1.4,c.h*.18,'#565f66');
        } else {
          // 笔记本：翻开的双层薄片，屏幕朝玩家一侧发光。
          this.stamp('block',c.x,c.y+c.h*.16,h*.28,c.w*.95,2,c.h*.7,'#3a4147');
          this.stamp('block',c.x,c.y-c.h*.18,h*.42,c.w*.9,2.2,c.h*.5,'#242a2f',0,1,-.55);
          this.stamp('block',c.x,c.y-c.h*.14,h*.52,c.w*.78,1.6,c.h*.4,'#79cfe8',0,1,-.55);
          this.stampGlow('disc',c.x,c.y-c.h*.3,h*.5,c.w*.6,7,c.h*.3,'#9fe6ff',0,.45);
        }
      } else {
        const crateColor=c.type==='weaponcase'?'#455d4b':c.type==='medbox'?'#e2d7b9':c.type==='toolbox'?'#397b82':c.type==='duffel'?'#65764c':'#bd8640';
        this.stamp('block',c.x,c.y,h/2,c.w,h,c.h,crateColor);
        const topColor=c.type==='weaponcase'?'#6d8669':c.type==='medbox'?'#f1e9cf':c.type==='toolbox'?'#68a3a6':c.type==='duffel'?'#8e9a59':'#dfa84f';
        this.stamp('block',c.x,c.y-(c.open>0?c.h*.36:0),h+1,c.w+1.5,3,c.h*(c.open>0?.35:1),topColor);
        for(const sign of [-1,1])this.stamp('block',c.x+c.w*.31*sign,c.y,h+3,2.5,2,c.h,'#484f40');
        for(const side of [-1,1])this.stamp('block',c.x+side*(c.w*.43),c.y,h*.55,3,h*.8,c.h*.9,c.type==='crate'?'#70491f':'#39473b');
        if(c.type==='crate') {
          for(const side of [-1,1]) {
            this.stamp('block',c.x+side*(c.w*.24),c.y+c.h*.43,h*.52,c.w*.06,h*.76,2.5,'#d9a14e');
            this.stamp('block',c.x+side*(c.w*.24),c.y,h+3,c.w*.055,2,c.h*.88,'#f0c16b');
          }
        }
        if(c.type==='duffel')this.stamp('block',c.x,c.y,h+3,c.w*.12,2,c.h*.82,'#d3b56a');
        if(c.type==='weaponcase') {
          this.stamp('block',c.x,c.y,h+3,c.w*.32,1.1,2.8,'#d2d5b3');
          this.stamp('block',c.x-c.w*.07,c.y+2,h+3,3,1.1,5.5,'#d2d5b3');
          if(c.open>0) {
            // 打开的武器箱升起稀有度光柱，隔着掩体也能看到。
            const beam=.4+.15*Math.sin(g.realT*3);
            this.stampGlow('disc',c.x,c.y,h+34,16,60,16,'#ffe9a8',0,beam);
          }
        }
      }
      if(g.nearC===c)this.stamp('ring',c.x,c.y,1,c.w+14,4,c.h+14,'#ffdd74');
      this.actorAlpha=1;
    }
    const p=g.player;
    if(g.mode==='raid' && !p.dead) {
      const colors = p.character.id==='scout'?['#addee0','#496e73']:p.character.id==='tank'?['#c1c4ae','#58604b']:['#ffd453','#626f4e'];
      this.bird(p.x,p.y,p.r,p.aim,colors[0],colors[1],!!p.weapons[p.cur],p.walk,false,false,p.flash>0,p.rollT>0);
      this.stamp('ring',p.x,p.y,1,p.r*2.45,5,p.r*2.45,'#fce999');
    }
    for(const e of g.enemies) {
      if(e.dead || (g.mode==='raid' && e.visA<.03) || !visible(e.x,e.y,420))continue;
      const colors=FEATHER_COLORS[e.type];
      this.actorAlpha=g.mode==='raid'?e.visA:1;
      this.bird(e.x,e.y,e.r,e.aim,colors[0],colors[1],!!e.weapon,e.walk,!!e.def.boss,e.type==='chicken',e.flash>0,false,e.type);
      this.actorAlpha=1;
      const range=e.def.encounter?.phases[e.skillPhase].range;
      if(e.special==='chargeWind') {
        const len=range??390;
        this.stamp('block',e.x+e.cdx*len/2,e.y+e.cdy*len/2,1,len,1,e.r*2,'#f47858',Math.atan2(e.cdy,e.cdx));
      }
      if(e.special==='honkWind'||e.special==='summonWind') {
        const radius=e.special==='summonWind'?Math.min(260,(range??260)*.42):range??290;
        this.stamp('ring',e.x,e.y,1.5,radius*2,5,radius*2,e.special==='summonWind'?'#a8ed82':'#ff9c61');
      }
    }
    for(const b of g.bullets) {
      if (!visible(b.x,b.y,80)) continue;
      const speed = Math.hypot(b.vx,b.vy);
      if (speed === 0) continue;
      const [edge, core] = b.chill ? ['#487b99','#c8f1ff'] : b.explosive ? ['#a74b24','#ffe2a6']
        : b.from ? ['#a6412b','#ffb18b'] : ['#a16726','#fff0ad'];
      const angle = Math.atan2(b.vy,b.vx);
      const width = Math.min(13, Math.max(6.6 / Math.max(.5, g.cam.zoom), b.w * 2.45));
      const head = width * 1.38;
      const trail = Math.min(Math.hypot(b.x - b.ox, b.y - b.oy), 22, speed * .018);
      const at = (offset: number) => [b.x - b.vx/speed*offset, b.y - b.vy/speed*offset] as const;
      if (trail > 1) this.stamp('projectile', ...at((head + trail) / 2), 17, trail, width * .54, width * .54, edge, angle, .50);
      this.stamp('projectile', ...at(0), 17, head, width * 1.23, width * 1.23, edge, angle, .86);
      this.stampGlow('projectile', ...at(-width * .12), 17.4, head * .83, width * .76, width * .76, core, angle, .89);
    }
    for (const n of g.grenades) {
      if (n.kind === 'fire') {
        const dx = Math.cos(n.spin) * 6, dy = Math.sin(n.spin) * 6;
        this.stamp('round', n.x, n.y, n.z + 6, 15, 9, 8, '#746238', n.spin);
        this.stamp('block', n.x + dx, n.y + dy, n.z + 6, 6, 4, 4, '#9b8056', n.spin);
        this.stampGlow('flame', n.x + dx * 1.55, n.y + dy * 1.55, n.z + 10,
          5, 8 + Math.sin(this.animT * 25) * 2, 4, '#ffb855', n.spin, .8);
      } else this.stamp('round', n.x, n.y, n.z + 4, 10, 12, 10, n.egg ? '#fff4d2' : '#565b42');
    }
    for (const f of g.fires) if (visible(f.x, f.y, f.r + 75)) this.burningGround(f);
    for(const s of g.smokes)this.stamp('round',s.x,s.y,8,s.r*2,24,s.r*2,'#c5c6b7',0,.38);
    for(const q of g.particles) {
      if(!visible(q.x,q.y))continue;
      const fade = Math.min(1, Math.max(0, q.life/q.max));
      const size=Math.max(1,Math.min(18,q.size)) * Math.min(1,q.life/.1);
      if(q.type===P_RING || q.type===P_DUST || q.type===P_SMOKE) {
        // The color cache extracts RGB. Preserve the source alpha here and fade with age.
        const sourceAlpha = Number(q.color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/)?.[1] ?? 1);
        if (q.type===P_RING) this.stamp('ring',q.x,q.y,1,q.size*2,3,q.size*2,q.color,0,fade*sourceAlpha);
        else this.stamp('round',q.x,q.y,q.z+1,size,size*.45,size,q.color,q.rot,fade*sourceAlpha*(q.type===P_DUST ? .65 : .38));
      }
      else if(q.type===P_FIRE) {
        const height = size * (1.4 + (1 - fade) * .8);
        this.stamp('flame',q.x,q.y,q.z + height / 2,size,height,size*.65,q.color,q.rot,fade*.72);
      } else if(q.type===P_SPARK || q.type===P_MUZZLE) {
        const sparkSize = size * (q.type===P_MUZZLE ? .65 : .86);
        this.stamp('round',q.x,q.y,q.z+2,sparkSize,sparkSize,sparkSize,q.color,q.rot,fade*.8);
      } else this.stamp('crown',q.x,q.y,q.z+1,size,size*.7,size,q.color,q.rot);
    }
    for(const b of this.batches.values()){
      b.mesh.count=b.used; b.mesh.instanceMatrix.needsUpdate=true;
      if(b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;
    }
    for(const b of this.glowBatches.values()){
      b.mesh.count=b.used; b.mesh.instanceMatrix.needsUpdate=true;
      if(b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;
    }
    this.gl.render(this.scene,this.camera);
  }

  dispose() {
    this.removeTerrain();
    for(const b of this.batches.values())b.mesh.dispose();
    for(const b of this.glowBatches.values())b.mesh.dispose();
    for(const shape of Object.values(this.shapes))shape.dispose();
    for(const material of this.translucent.values())material.dispose();
    for(const material of this.glowOpacities.values())material.dispose();
    this.glowMaterial.dispose();
    this.material.dispose(); this.gl.dispose();
  }
}
