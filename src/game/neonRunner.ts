import * as THREE from "three";

export type GameState = "ready" | "playing" | "over";

export interface GameCallbacks {
  onScore: (score: number) => void;
  onSpeed: (speed: number) => void;
  onState: (state: GameState) => void;
}

const LANES = [-2.2, 0, 2.2];

export class NeonRunner {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;

  private ship = new THREE.Group();
  private shipTilt = 0;
  private lane = 1;
  private laneX = 0;

  private obstacles: THREE.Mesh[] = [];
  private orbs: THREE.Mesh[] = [];
  private trail: THREE.Points;
  private trailPositions: Float32Array;
  private trailIndex = 0;

  private tunnelRings: THREE.Mesh[] = [];
  private stars: THREE.Points;
  private floorBars: THREE.Mesh[] = [];

  private speed = 22;
  private distance = 0;
  private score = 0;
  private shake = 0;
  private state: GameState = "ready";
  private spawnTimer = 0;

  constructor(
    private container: HTMLElement,
    private cb: GameCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.domElement.style.display = "block";
    container.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.FogExp2(0x05010f, 0.016);
    this.scene.background = new THREE.Color(0x05010f);

    this.camera = new THREE.PerspectiveCamera(
      72,
      container.clientWidth / container.clientHeight,
      0.1,
      300,
    );
    this.camera.position.set(0, 2.6, 8);

    this.buildLights();
    this.buildShip();
    this.buildTunnel();
    this.buildGrid();

    // trail particles
    const N = 300;
    this.trailPositions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) this.trailPositions[i * 3 + 2] = 999;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(this.trailPositions, 3));
    this.trail = new THREE.Points(
      tg,
      new THREE.PointsMaterial({
        color: 0x35f2ff,
        size: 0.035,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.scene.add(this.trail);

    // starfield
    const sN = 700;
    const sp = new Float32Array(sN * 3);
    for (let i = 0; i < sN; i++) {
      sp[i * 3] = (Math.random() - 0.5) * 90;
      sp[i * 3 + 1] = Math.random() * 40 - 5;
      sp[i * 3 + 2] = -Math.random() * 260;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(
      sg,
      new THREE.PointsMaterial({
        color: 0xff4fd8,
        size: 0.35,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.scene.add(this.stars);

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKey);
    container.addEventListener("pointerdown", this.onPointer);

    this.loop();
  }

  private buildLights() {
    this.scene.add(new THREE.AmbientLight(0x4455ff, 0.6));
    const d = new THREE.DirectionalLight(0x66ffff, 1.2);
    d.position.set(3, 8, 5);
    this.scene.add(d);
    const p = new THREE.PointLight(0xff2fd0, 3, 30);
    p.position.set(0, 2, 2);
    this.scene.add(p);
  }

  private buildShip() {
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.8, 4),
      new THREE.MeshStandardMaterial({
        color: 0x0affff,
        emissive: 0x0a6f8f,
        metalness: 0.9,
        roughness: 0.15,
      }),
    );
    body.rotation.x = -Math.PI / 2;
    this.ship.add(body);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0xff4fd8,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.position.z = 0.9;
    glow.scale.set(1, 1, 1.8);
    this.ship.add(glow);

    const wings = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.08, 0.5),
      new THREE.MeshStandardMaterial({
        color: 0x1b1040,
        emissive: 0x5a1aff,
        emissiveIntensity: 1.4,
        metalness: 0.8,
        roughness: 0.3,
      }),
    );
    wings.position.z = 0.5;
    this.ship.add(wings);

    this.ship.position.set(0, 1.1, 0);
    this.scene.add(this.ship);
  }

  private buildTunnel() {
    const geo = new THREE.TorusGeometry(7, 0.05, 6, 40);
    for (let i = 0; i < 30; i++) {
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0x35f2ff : 0xff4fd8,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
        }),
      );
      m.position.set(0, 2, -i * 9);
      this.scene.add(m);
      this.tunnelRings.push(m);
    }
  }

  private buildGrid() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 400),
      new THREE.MeshBasicMaterial({ color: 0x0a0320 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, -120);
    this.scene.add(floor);

    const lineMat = new THREE.MeshBasicMaterial({
      color: 0x35f2ff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    // cross bars scrolling toward the camera
    const barGeo = new THREE.PlaneGeometry(60, 0.08);
    for (let i = 0; i < 40; i++) {
      const bar = new THREE.Mesh(barGeo, lineMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(0, 0.03, -i * 6);
      this.scene.add(bar);
      this.floorBars.push(bar);
    }
    // lane rails
    const railGeo = new THREE.PlaneGeometry(0.09, 400);
    for (const x of [-3.3, -1.1, 1.1, 3.3]) {
      const rail = new THREE.Mesh(
        railGeo,
        new THREE.MeshBasicMaterial({
          color: 0xff4fd8,
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      rail.rotation.x = -Math.PI / 2;
      rail.position.set(x, 0.03, -180);
      this.scene.add(rail);
    }
  }

  start() {
    this.obstacles.forEach((o) => this.scene.remove(o));
    this.orbs.forEach((o) => this.scene.remove(o));
    this.obstacles = [];
    this.orbs = [];
    this.score = 0;
    this.distance = 0;
    this.speed = 22;
    this.lane = 1;
    this.spawnTimer = 0;
    this.setState("playing");
    this.cb.onScore(0);
  }

  private setState(s: GameState) {
    this.state = s;
    this.cb.onState(s);
  }

  move(dir: -1 | 1) {
    if (this.state !== "playing") return;
    this.lane = Math.max(0, Math.min(2, this.lane + dir));
    this.shipTilt = dir * 0.5;
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "a") this.move(-1);
    else if (e.key === "ArrowRight" || e.key === "d") this.move(1);
    else if (e.key === " " && this.state !== "playing") this.start();
  };

  private onPointer = (e: PointerEvent) => {
    if (this.state !== "playing") return;
    const rect = this.container.getBoundingClientRect();
    this.move(e.clientX - rect.left < rect.width / 2 ? -1 : 1);
  };

  private onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private spawn() {
    const lane = Math.floor(Math.random() * 3);
    if (Math.random() < 0.32) {
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.45, 1),
        new THREE.MeshBasicMaterial({
          color: 0xffe45e,
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0.95,
        }),
      );
      orb.position.set(LANES[lane]!, 1.2, -120);
      this.scene.add(orb);
      this.orbs.push(orb);
    } else {
      const h = 1.6 + Math.random() * 1.6;
      const ob = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, h, 1.6),
        new THREE.MeshStandardMaterial({
          color: 0x2a0a4a,
          emissive: 0xff2fd0,
          emissiveIntensity: 1.1,
          metalness: 0.7,
          roughness: 0.25,
        }),
      );
      ob.position.set(LANES[lane]!, h / 2, -120);
      this.scene.add(ob);
      this.obstacles.push(ob);
    }
  }

  private crash() {
    this.shake = 1.4;
    this.setState("over");
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    const playing = this.state === "playing";
    const v = playing ? this.speed : 6;

    if (playing) {
      this.speed += dt * 0.55;
      this.distance += v * dt;
      const s = Math.floor(this.distance / 4) + this.score;
      this.cb.onScore(s);
      this.cb.onSpeed(Math.round(this.speed * 8));
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawn();
        this.spawnTimer = Math.max(0.28, 0.85 - this.speed * 0.012);
      }
    }

    // ship motion
    const targetX = LANES[this.lane]!;
    this.laneX += (targetX - this.laneX) * Math.min(1, dt * 12);
    this.shipTilt += (0 - this.shipTilt) * Math.min(1, dt * 6);
    this.ship.position.x = this.laneX;
    this.ship.position.y = 1.1 + Math.sin(t * 3) * 0.12;
    this.ship.rotation.z = this.shipTilt + (targetX - this.laneX) * -0.35;
    this.ship.rotation.y = (targetX - this.laneX) * -0.15;
    if (this.state === "over") {
      this.ship.rotation.x += dt * 4;
      this.ship.position.y = Math.max(0.2, this.ship.position.y - dt * 2);
    }

    // trail
    const tp = this.trailPositions;
    tp[this.trailIndex * 3] = this.ship.position.x + (Math.random() - 0.5) * 0.25;
    tp[this.trailIndex * 3 + 1] = this.ship.position.y + (Math.random() - 0.5) * 0.2;
    tp[this.trailIndex * 3 + 2] = 1.4;
    this.trailIndex = (this.trailIndex + 1) % (tp.length / 3);
    for (let i = 0; i < tp.length / 3; i++) {
      const nz = tp[i * 3 + 2]! + v * dt * 0.9;
      tp[i * 3 + 2] = nz > 4.5 ? 999 : nz;
    }
    this.trail.geometry.attributes['position']!.needsUpdate = true;

    // world scroll
    for (const bar of this.floorBars) {
      bar.position.z += v * dt;
      if (bar.position.z > 12) bar.position.z -= 40 * 6;
    }
    for (const r of this.tunnelRings) {
      r.position.z += v * dt;
      r.rotation.z += dt * 0.4;
      if (r.position.z > 12) r.position.z -= 30 * 9;
    }
    const sPos = this.stars.geometry.attributes['position'] as THREE.BufferAttribute;
    for (let i = 0; i < sPos.count; i++) {
      let z = sPos.getZ(i) + v * dt * 1.4;
      if (z > 10) z -= 260;
      sPos.setZ(i, z);
    }
    sPos.needsUpdate = true;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i]!;
      o.position.z += v * dt;
      o.rotation.y += dt * 1.2;
      if (playing && o.position.z > -0.9 && o.position.z < 1.1) {
        if (Math.abs(o.position.x - this.ship.position.x) < 1.1) this.crash();
      }
      if (o.position.z > 14) {
        this.scene.remove(o);
        this.obstacles.splice(i, 1);
      }
    }

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i]!;
      o.position.z += v * dt;
      o.rotation.x += dt * 2;
      o.rotation.y += dt * 3;
      o.scale.setScalar(1 + Math.sin(t * 6 + i) * 0.15);
      const hit =
        playing &&
        Math.abs(o.position.z) < 1.2 &&
        Math.abs(o.position.x - this.ship.position.x) < 1.1;
      if (hit) {
        this.score += 25;
        this.shake = 0.25;
        this.scene.remove(o);
        this.orbs.splice(i, 1);
        continue;
      }
      if (o.position.z > 14) {
        this.scene.remove(o);
        this.orbs.splice(i, 1);
      }
    }

    // camera: follow + shake + speed FOV
    this.shake = Math.max(0, this.shake - dt * 2);
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    this.camera.position.x += (this.ship.position.x * 0.55 + sx - this.camera.position.x) * Math.min(1, dt * 6);
    this.camera.position.y = 6.2 + sy + Math.sin(t * 1.5) * 0.08;
    this.camera.position.z = 9.5;
    this.camera.lookAt(this.ship.position.x * 0.6, -1.2, -20);
    this.camera.rotation.z += this.shipTilt * 0.12;
    const targetFov = playing ? 72 + Math.min(18, this.speed - 22) : 66;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
    this.camera.updateProjectionMatrix();

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKey);
    this.container.removeEventListener("pointerdown", this.onPointer);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container)
      this.container.removeChild(this.renderer.domElement);
  }
}
