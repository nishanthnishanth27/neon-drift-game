import * as THREE from "three";

export type GameState = "ready" | "playing" | "over";

export interface GameCallbacks {
  onScore: (score: number) => void;
  onSpeed: (speed: number) => void;
  onState: (state: GameState) => void;
}

const LANES = [-2, 0, 2];
const TRACK_WIDTH = 6;
const COLORS = [0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0x95E1D3, 0xF38181, 0xAA96DA, 0xFCBBD3];

export class NeonRunner {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;

  private player = new THREE.Group();
  private playerTilt = 0;
  private playerRunAnimation = 0;
  private lane = 1;
  private laneX = 0;

  private obstacles: THREE.Mesh[] = [];
  private coins: THREE.Mesh[] = [];
  private platforms: THREE.Mesh[] = [];
  private buildings: THREE.Mesh[] = [];
  private trees: THREE.Mesh[] = [];
  private lights: THREE.Mesh[] = [];
  private sceneryPieces: THREE.Mesh[] = [];

  private speed = 28;
  private distance = 0;
  private score = 0;
  private shake = 0;
  private state: GameState = "ready";
  private spawnTimer = 0;
  private buildingSpawnTimer = 0;

  constructor(
    private container: HTMLElement,
    private cb: GameCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.domElement.style.display = "block";
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    // Beautiful sky gradient
    this.setupScene();
    this.buildLighting();
    this.buildPlayer();
    this.buildRailway();
    this.buildEnvironment();

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKey);
    container.addEventListener("pointerdown", this.onPointer);

    this.loop();
  }

  private setupScene() {
    // Sky gradient using canvas texture
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, "#87CEEB");
    gradient.addColorStop(0.5, "#E0F6FF");
    gradient.addColorStop(1, "#FFFACD");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    const skyTexture = new THREE.CanvasTexture(canvas);
    this.scene.background = skyTexture;
    
    // Fog for depth
    this.scene.fog = new THREE.Fog(0xE0F6FF, 120, 300);

    // Initialize camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      500,
    );
    this.camera.position.set(0, 5.2, 8.5);
  }

  private buildLighting() {
    // Ambient light for overall brightness
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    // Warm sun light with shadows
    const sunLight = new THREE.DirectionalLight(0xffd89b, 1.2);
    sunLight.position.set(40, 60, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.bias = -0.0001;
    this.scene.add(sunLight);

    // Fill light for balanced lighting
    const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.6);
    fillLight.position.set(-40, 30, -30);
    this.scene.add(fillLight);

    // Rim light for definition
    const rimLight = new THREE.DirectionalLight(0xff9999, 0.3);
    rimLight.position.set(0, 20, -50);
    this.scene.add(rimLight);
  }

  private buildPlayer() {
    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 20, 20),
      new THREE.MeshStandardMaterial({
        color: 0xffc9a8,
        emissive: 0xff9955,
        emissiveIntensity: 0.2,
        metalness: 0.1,
        roughness: 0.8,
      }),
    );
    head.position.y = 1.3;
    head.castShadow = true;
    head.receiveShadow = true;
    this.player.add(head);

    // Hair
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 20, 20),
      new THREE.MeshStandardMaterial({
        color: 0x8B4513,
        emissive: 0x5C2E0F,
        emissiveIntensity: 0.3,
        metalness: 0.2,
        roughness: 0.7,
      }),
    );
    hair.position.set(0, 1.5, -0.1);
    hair.scale.set(1, 1.1, 0.9);
    hair.castShadow = true;
    hair.receiveShadow = true;
    this.player.add(hair);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.1, 12, 12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.15, 1.4, 0.35);
    this.player.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.15, 1.4, 0.35);
    this.player.add(rightEye);

    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const pupilGeo = new THREE.SphereGeometry(0.05, 8, 8);

    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(-0.15, 1.4, 0.41);
    this.player.add(leftPupil);

    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.position.set(0.15, 1.4, 0.41);
    this.player.add(rightPupil);

    // Body/Torso
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.85, 0.4),
      new THREE.MeshStandardMaterial({
        color: 0xff3366,
        emissive: 0xcc0033,
        emissiveIntensity: 0.3,
        metalness: 0.4,
        roughness: 0.7,
      }),
    );
    body.position.y = 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    this.player.add(body);

    // Arms (left and right)
    const armMat = new THREE.MeshStandardMaterial({
      color: 0xffc9a8,
      emissive: 0xff9955,
      emissiveIntensity: 0.2,
      metalness: 0.1,
      roughness: 0.8,
    });

    const leftArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.8, 0.25),
      armMat,
    );
    leftArm.position.set(-0.5, 0.7, 0);
    leftArm.rotation.z = 0.3;
    leftArm.castShadow = true;
    leftArm.receiveShadow = true;
    this.player.add(leftArm);

    const rightArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.8, 0.25),
      armMat,
    );
    rightArm.position.set(0.5, 0.7, 0);
    rightArm.rotation.z = -0.3;
    rightArm.castShadow = true;
    rightArm.receiveShadow = true;
    this.player.add(rightArm);

    // Legs
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x1a4d7a,
      emissive: 0x0d2a4a,
      emissiveIntensity: 0.2,
      metalness: 0.2,
      roughness: 0.8,
    });

    const leftLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.8, 0.3),
      legMat,
    );
    leftLeg.position.set(-0.2, -0.2, 0);
    leftLeg.castShadow = true;
    leftLeg.receiveShadow = true;
    this.player.add(leftLeg);

    const rightLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.8, 0.3),
      legMat,
    );
    rightLeg.position.set(0.2, -0.2, 0);
    rightLeg.castShadow = true;
    rightLeg.receiveShadow = true;
    this.player.add(rightLeg);

    // Shoes
    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0xFF6B6B,
      emissive: 0xDD4444,
      emissiveIntensity: 0.4,
      metalness: 0.5,
      roughness: 0.6,
    });

    const leftShoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.35, 0.5),
      shoeMat,
    );
    leftShoe.position.set(-0.2, -0.9, 0);
    leftShoe.castShadow = true;
    leftShoe.receiveShadow = true;
    this.player.add(leftShoe);

    const rightShoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.35, 0.5),
      shoeMat,
    );
    rightShoe.position.set(0.2, -0.9, 0);
    rightShoe.castShadow = true;
    rightShoe.receiveShadow = true;
    this.player.add(rightShoe);

    this.player.position.set(0, 0, 0);
    this.scene.add(this.player);
  }

  private buildRailway() {
    // Main track surface
    const trackMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      metalness: 0.4,
      roughness: 0.6,
    });

    for (let i = 0; i < 50; i++) {
      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(TRACK_WIDTH, 0.4, 4),
        trackMaterial,
      );
      platform.position.z = -i * 4;
      platform.castShadow = true;
      platform.receiveShadow = true;
      this.scene.add(platform);
      this.platforms.push(platform);
    }

    // Track dividers
    const dividerMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff99,
      emissive: 0xffff00,
      emissiveIntensity: 0.5,
      metalness: 0.3,
      roughness: 0.4,
    });

    for (const x of LANES) {
      for (let i = 0; i < 50; i++) {
        const divider = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.45, 2),
          dividerMaterial,
        );
        divider.position.set(x, 0.25, -i * 4 - 2);
        divider.castShadow = true;
        divider.receiveShadow = true;
        this.scene.add(divider);
        this.platforms.push(divider);
      }
    }

    // Side borders/curbs
    const curbMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.2,
      roughness: 0.8,
    });

    for (let i = 0; i < 50; i++) {
      const leftCurb = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.35, 4),
        curbMaterial,
      );
      leftCurb.position.set(-TRACK_WIDTH / 2 - 0.15, 0.2, -i * 4);
      leftCurb.castShadow = true;
      this.scene.add(leftCurb);
      this.platforms.push(leftCurb);

      const rightCurb = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.35, 4),
        curbMaterial,
      );
      rightCurb.position.set(TRACK_WIDTH / 2 + 0.15, 0.2, -i * 4);
      rightCurb.castShadow = true;
      this.scene.add(rightCurb);
      this.platforms.push(rightCurb);
    }
  }

  private buildEnvironment() {
    // Ground grass
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a9d5f,
      metalness: 0.05,
      roughness: 0.95,
    });

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 600),
      groundMaterial,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.position.z = -150;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Initial buildings and trees
    for (let i = 0; i < 4; i++) {
      this.spawnBuilding(-10, -i * 40);
      this.spawnBuilding(10, -i * 40);
      this.spawnTree(-8, -i * 40 - 20);
      this.spawnTree(8, -i * 40 - 20);
    }

    this.buildingSpawnTimer = 25;
  }

  private spawnBuilding(sideX: number, zPos: number) {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]!;
    const height = 8 + Math.random() * 12;
    const width = 4 + Math.random() * 3;
    const depth = 5 + Math.random() * 3;

    const building = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.3,
        roughness: 0.6,
      }),
    );

    building.position.set(sideX, height / 2, zPos);
    building.castShadow = true;
    building.receiveShadow = true;
    this.scene.add(building);
    this.buildings.push(building);

    // Windows with warm glow
    const windowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdd88,
      blending: THREE.AdditiveBlending,
    });

    const windowCount = Math.floor(height / 1.8);
    const windowCountHorizontal = Math.floor(width / 1.0);

    for (let y = 0; y < windowCount; y++) {
      for (let x = 0; x < windowCountHorizontal; x++) {
        if (Math.random() > 0.2) {
          const window = new THREE.Mesh(
            new THREE.PlaneGeometry(0.7, 0.7),
            windowMaterial,
          );
          window.position.set(
            sideX + (x - windowCountHorizontal / 2) * 1.0 + 0.5,
            height / 2 - 1 + y * 1.8,
            zPos + depth / 2 + 0.05,
          );
          this.scene.add(window);
          this.buildings.push(window);
        }
      }
    }
  }

  private spawnTree(sideX: number, zPos: number) {
    // Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.5, 4, 8),
      new THREE.MeshStandardMaterial({
        color: 0x654321,
        metalness: 0.1,
        roughness: 0.9,
      }),
    );
    trunk.position.set(sideX, 2, zPos);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    this.scene.add(trunk);
    this.trees.push(trunk);

    // Foliage
    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(2.5, 5, 16),
      new THREE.MeshStandardMaterial({
        color: 0x2d5a2d,
        metalness: 0.1,
        roughness: 0.8,
      }),
    );
    foliage.position.set(sideX, 5, zPos);
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    this.scene.add(foliage);
    this.trees.push(foliage);
  }

  private spawnStreetLight(sideX: number, zPos: number) {
    // Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 5, 6),
      new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.6,
        roughness: 0.4,
      }),
    );
    pole.position.set(sideX, 2.5, zPos);
    pole.castShadow = true;
    pole.receiveShadow = true;
    this.scene.add(pole);
    this.lights.push(pole);

    // Light bulb
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffdd88,
        blending: THREE.AdditiveBlending,
      }),
    );
    bulb.position.set(sideX, 5, zPos);
    this.scene.add(bulb);
    this.lights.push(bulb);

    // Light effect
    const pointLight = new THREE.PointLight(0xffdd88, 1.5, 30);
    pointLight.position.set(sideX, 5, zPos);
    pointLight.castShadow = true;
    this.scene.add(pointLight);
  }

  start() {
    this.obstacles.forEach((o) => this.scene.remove(o));
    this.coins.forEach((o) => this.scene.remove(o));
    this.obstacles = [];
    this.coins = [];
    this.score = 0;
    this.distance = 0;
    this.speed = 28;
    this.lane = 1;
    this.laneX = 0;
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
    this.playerTilt = dir * 0.4;
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") this.move(-1);
    else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") this.move(1);
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

    // Spawn coins (60% chance)
    if (Math.random() < 0.6) {
      const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16),
        new THREE.MeshStandardMaterial({
          color: 0xFFD700,
          emissive: 0xFFA500,
          emissiveIntensity: 0.7,
          metalness: 0.9,
          roughness: 0.1,
        }),
      );
      coin.position.set(LANES[lane]!, 1.0, -130);
      coin.rotation.x = Math.PI / 2;
      coin.castShadow = true;
      coin.receiveShadow = true;
      this.scene.add(coin);
      this.coins.push(coin);
    } else {
      // Spawn obstacles
      const obstacleTypes = [
        { w: 1.8, h: 2.2, d: 1.8, color: 0xFF6B6B },
        { w: 1.8, h: 2.2, d: 1.8, color: 0x4ECDC4 },
        { w: 1.6, h: 2.8, d: 1.6, color: 0xAA96DA },
      ];

      const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)]!;
      const ob = new THREE.Mesh(
        new THREE.BoxGeometry(type.w, type.h, type.d),
        new THREE.MeshStandardMaterial({
          color: type.color,
          metalness: 0.4,
          roughness: 0.5,
        }),
      );
      ob.position.set(LANES[lane]!, type.h / 2 + 0.2, -130);
      ob.castShadow = true;
      ob.receiveShadow = true;
      this.scene.add(ob);
      this.obstacles.push(ob);
    }
  }

  private crash() {
    this.shake = 1.0;
    this.setState("over");
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    const playing = this.state === "playing";
    const v = playing ? this.speed : 8;

    if (playing) {
      this.speed += dt * 0.9;
      this.distance += v * dt;
      this.cb.onSpeed(Math.round(this.speed * 1.5));

      // Spawn obstacles
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawn();
        this.spawnTimer = Math.max(0.35, 1.2 - this.speed * 0.015);
      }

      // Spawn scenery
      this.buildingSpawnTimer -= dt;
      if (this.buildingSpawnTimer <= 0) {
        const side = Math.random() > 0.5 ? -10 : 10;
        this.spawnBuilding(side, this.distance - 100);
        if (Math.random() > 0.7) {
          this.spawnTree(side + (Math.random() > 0.5 ? 2 : -2), this.distance - 100 + 20);
        }
        if (Math.random() > 0.8) {
          this.spawnStreetLight(side, this.distance - 100 + 40);
        }
        this.buildingSpawnTimer = 30;
      }
    }

    // Player animation and movement
    const targetX = LANES[this.lane]!;
    this.laneX += (targetX - this.laneX) * Math.min(1, dt * 9);
    this.playerTilt += (0 - this.playerTilt) * Math.min(1, dt * 8);

    this.player.position.x = this.laneX;
    this.player.position.y = 0.05;

    // Running animation
    if (playing) {
      this.playerRunAnimation += dt * this.speed;
      const armSwing = Math.sin(this.playerRunAnimation * Math.PI * 2) * 0.6;
      
      // Animate arms
      const arms = this.player.children.filter((c: any) => c.position.x !== undefined && Math.abs(c.position.x) > 0.4);
      if (arms.length >= 2) {
        (arms[0] as THREE.Mesh).rotation.z = 0.3 + armSwing * 0.4;
        (arms[1] as THREE.Mesh).rotation.z = -0.3 - armSwing * 0.4;
      }
    }

    this.player.rotation.z = this.playerTilt + (targetX - this.laneX) * -0.2;
    this.player.rotation.y = (targetX - this.laneX) * -0.15;

    if (this.state === "over") {
      this.player.rotation.x += dt * 6;
      this.player.position.y = Math.max(-1, this.player.position.y - dt * 4);
    }

    // Scroll platforms
    for (let i = this.platforms.length - 1; i >= 0; i--) {
      const p = this.platforms[i]!;
      p.position.z += v * dt;
      if (p.position.z > 10) {
        this.scene.remove(p);
        this.platforms.splice(i, 1);
      }
    }

    // Add new platforms
    if (this.platforms.length < 60) {
      const newZ = this.platforms.length > 0 ? this.platforms[0]!.position.z - 4 : -200;

      const trackMaterial = new THREE.MeshStandardMaterial({
        color: 0x555555,
        metalness: 0.4,
        roughness: 0.6,
      });

      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(TRACK_WIDTH, 0.4, 4),
        trackMaterial,
      );
      platform.position.z = newZ;
      platform.castShadow = true;
      platform.receiveShadow = true;
      this.scene.add(platform);
      this.platforms.push(platform);
    }

    // Obstacles collision and animation
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i]!;
      o.position.z += v * dt;
      o.rotation.y += dt * 2.5;
      o.rotation.x += dt * 1;

      if (playing && o.position.z > -1.5 && o.position.z < 1.5) {
        if (Math.abs(o.position.x - this.player.position.x) < 0.85) {
          this.crash();
        }
      }

      if (o.position.z > 15) {
        this.scene.remove(o);
        this.obstacles.splice(i, 1);
      }
    }

    // Coins collection
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i]!;
      c.position.z += v * dt;
      c.rotation.z += dt * 5;
      c.rotation.x += dt * 2.5;
      c.position.y = 1.0 + Math.sin(t * 3 + i) * 0.3;
      c.scale.setScalar(1 + Math.sin(t * 4 + i * 0.5) * 0.1);

      const hit =
        playing &&
        Math.abs(c.position.z) < 1.5 &&
        Math.abs(c.position.x - this.player.position.x) < 0.85;

      if (hit) {
        this.score += 10;
        this.shake = 0.2;
        this.scene.remove(c);
        this.coins.splice(i, 1);
        continue;
      }

      if (c.position.z > 15) {
        this.scene.remove(c);
        this.coins.splice(i, 1);
      }
    }

    // Remove far scenery
    for (let i = this.buildings.length - 1; i >= 0; i--) {
      const b = this.buildings[i]!;
      if (b.position.z > 80) {
        this.scene.remove(b);
        this.buildings.splice(i, 1);
      }
    }

    // Update score
    const s = this.score + Math.floor(this.distance / 5);
    this.cb.onScore(s);

    // Camera shake
    this.shake = Math.max(0, this.shake - dt * 3);
    const sx = (Math.random() - 0.5) * this.shake * 0.6;
    const sy = (Math.random() - 0.5) * this.shake * 0.6;

    // Smooth camera follow
    const targetCameraX = this.player.position.x * 0.35 + sx;
    const targetCameraY = 5.2 + sy + Math.sin(t * 0.6) * 0.15;
    const targetCameraZ = this.player.position.z + 8.5;

    this.camera.position.x += (targetCameraX - this.camera.position.x) * Math.min(1, dt * 5);
    this.camera.position.y += (targetCameraY - this.camera.position.y) * Math.min(1, dt * 5);
    this.camera.position.z += (targetCameraZ - this.camera.position.z) * Math.min(1, dt * 8);

    const lookAheadZ = this.player.position.z - 30;
    this.camera.lookAt(this.player.position.x * 0.2, 1.2, lookAheadZ);
    this.camera.rotation.z += this.playerTilt * 0.06;

    // Dynamic FOV
    const targetFov = playing ? 60 + Math.min(18, (this.speed - 28) * 0.7) : 55;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 2);
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
