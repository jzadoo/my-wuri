import * as THREE from 'three'
import '../style.css'

// ==================== 기본 설정 ====================
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.02);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);

// 조명
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 1, 100);
pointLight.position.set(0, 0, 10);
scene.add(pointLight);

// ==================== 마우스 추적 ====================
const mouse = new THREE.Vector2();
window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// zWorld 평면에서의 마우스 월드 좌표
function getMouseWorldAtZ(zWorld) {
  const ndc = new THREE.Vector3(mouse.x, mouse.y, 0.5);
  ndc.unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  const t = (zWorld - camera.position.z) / dir.z;
  return new THREE.Vector3().copy(camera.position).add(dir.multiplyScalar(t));
}

// ==================== 흰색 커서 점 ====================
// 더 작게, 펄싱 제거, 은은한 글로우(Additive)
const cursorGeometry = new THREE.SphereGeometry(0.03, 16, 16);
const cursorMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.95
});
const cursorDot = new THREE.Mesh(cursorGeometry, cursorMaterial);
scene.add(cursorDot);

const cursorGlowGeometry = new THREE.SphereGeometry(0.11, 16, 16);
const cursorGlowMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.35,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const cursorGlow = new THREE.Mesh(cursorGlowGeometry, cursorGlowMaterial);
cursorDot.add(cursorGlow);

// ==================== 파티클 그룹 생성 ====================
function createParticleGroup(color, count, baseX, baseZ) {
  const particles = [];
  const scatteredPositions = [];
  const group = new THREE.Group();

  for (let i = 0; i < count; i++) {
    const geometry = new THREE.SphereGeometry(0.04, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8
    });
    const particle = new THREE.Mesh(geometry, material);

    const scatteredPos = new THREE.Vector3(
      baseX + (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4,
      baseZ + (Math.random() - 0.5) * 3
    );

    particle.position.copy(scatteredPos);
    particle.userData.basePosition = new THREE.Vector3(baseX, 0, baseZ);
    particle.userData.scatteredOffset = scatteredPos.clone().sub(particle.userData.basePosition);

    scatteredPositions.push(scatteredPos.clone());
    group.add(particle);
    particles.push(particle);
  }

  scene.add(group);
  return { particles, scatteredPositions, group, baseX, baseZ };
}

// ==================== 형태 생성 함수들 ====================
function getCubeFormation(index, total) {
  const size = Math.ceil(Math.pow(total, 1 / 3));
  const x = (index % size) - size / 2;
  const y = (Math.floor(index / size) % size) - size / 2;
  const z = Math.floor(index / (size * size)) - size / 2;
  return new THREE.Vector3(x * 0.25, y * 0.25, z * 0.25);
}
function getWaveFormation(index, total) {
  const angle = (index / total) * Math.PI * 6;
  const radius = 1.2 + Math.sin(angle * 3) * 0.4;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle * 2) * 0.6;
  const z = Math.sin(angle) * radius;
  return new THREE.Vector3(x, y, z);
}
function getPyramidFormation(index, total) {
  const layers = 12;
  const layer = Math.floor((index / total) * layers);
  const inLayer = index % Math.ceil(total / layers);
  const maxInLayer = Math.ceil(total / layers);
  const radius = (layers - layer) * 0.18;
  const angle = (inLayer / maxInLayer) * Math.PI * 2;
  const x = Math.cos(angle) * radius;
  const y = -1.2 + layer * 0.2;
  const z = Math.sin(angle) * radius;
  return new THREE.Vector3(x, y, z);
}

// ==================== 파티클 그룹 ====================
const greenGroup = createParticleGroup(0x00ff88, 125, 4, -15);   // 오른쪽
const blueGroup  = createParticleGroup(0x0088ff, 150, -4, -35);  // 왼쪽
const redGroup   = createParticleGroup(0xff3344, 125, 4, -55);   // 오른쪽

// ==================== 스크롤/상태 ====================
let scrollProgress = 0;
let cameraZ = 5;
let finalSphereStarted = false;
let finalCameraZ = null;
let isRotating = false;
let sphereCenter = new THREE.Vector3(0, 0, 0);

const introText = document.getElementById('intro-text');

window.addEventListener('scroll', () => {
  if (finalSphereStarted) return; // 최종 모드 이후 스크롤 무시

  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress = maxScroll > 0 ? (window.scrollY / maxScroll) : 0;

  // 카메라 이동
  cameraZ = 5 - scrollProgress * 70;

  // 인트로 문구 표시/숨김
  if (scrollProgress > 0.01) introText.classList.add('hidden');
  else introText.classList.remove('hidden');

  // 최종 구체 생성 트리거
  if (scrollProgress > 0.92 && !finalSphereStarted) {
    startFinalSequence();
  }
});

// ==================== 호버 체크(정확한 중심 사용) ====================
function checkHover(particleGroup, cameraZNow) {
  const groupZ = particleGroup.baseZ;
  const distanceToGroup = Math.abs(cameraZNow - groupZ);
  if (distanceToGroup > 8) return false;

  // 그룹 실제 중심 (baseX,0,baseZ) 사용
  const centerWorld = new THREE.Vector3(particleGroup.baseX, 0, particleGroup.baseZ);
  const centerNDC = centerWorld.clone().project(camera);

  const dx = mouse.x - centerNDC.x;
  const dy = mouse.y - centerNDC.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // 거리가 가까울수록 판정 반경 조금 커짐
  const radiusNDC = THREE.MathUtils.clamp(0.35 + (8 - distanceToGroup) * 0.02, 0.25, 0.5);
  return distance < radiusNDC;
}

// ==================== 구체 관련(분포/회전) ====================
function fract(x) { return x - Math.floor(x); }
function hash3(x, y, z) {
  return fract(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453);
}
// 대륙/대양/사막 대략적 마스크
function categoryForDir(dir) {
  const lat = Math.asin(dir.y);        // -pi/2..pi/2
  const lon = Math.atan2(dir.z, dir.x); // -pi..pi
  let n = hash3(Math.round(dir.x * 50), Math.round(dir.y * 50), Math.round(dir.z * 50));
  n += 0.15 * Math.sin(3 * lon) * Math.cos(2 * lat);

  if (lat > 1.2 || lat < -1.2) return 'ocean'; // 극지
  if (Math.abs(lat) < 0.35 && n > 0.48 && n < 0.58) return 'desert'; // 적도 사막대
  return n > 0.55 ? 'land' : 'ocean';
}

const sphereRotation = new THREE.Euler(0, 0, 0);
let autoRotateSpeed = 0.001;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// ==================== 최종 시퀀스 ====================
function preventScroll(e) { e.preventDefault(); }
function lockScroll() {
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  window.addEventListener('wheel', preventScroll, { passive: false });
  window.addEventListener('touchmove', preventScroll, { passive: false });
  // body.classList.add('lock-scroll'); // CSS 방식 사용 시
}

function startFinalSequence() {
  if (finalSphereStarted) return;
  finalSphereStarted = true;

  // 카메라 z 고정
  finalCameraZ = camera.position.z;
  cameraZ = finalCameraZ;

  // 인트로 문구 영구 숨김
  introText.classList.add('hidden');
  introText.style.display = 'none';

  // 스크롤 잠그기
  lockScroll();

  // 커서 분리: 흰 점 중앙에 고정, 구체 모드 시작
  isRotating = true;
  sphereCenter.set(0, 0, camera.position.z - 3);
  cursorDot.position.copy(sphereCenter);

  // 모든 파티클
  const allParticles = [
    ...greenGroup.particles,
    ...blueGroup.particles,
    ...redGroup.particles
  ];

  // 구 표면 타겟 생성 + 색 분포
  const radius = 2.5;
  const landTargets = [];
  const oceanTargets = [];
  const desertTargets = [];

  for (let i = 0; i < allParticles.length; i++) {
    // Fibonacci 유사 분포
    const phi = Math.acos(-1 + (2 * i) / allParticles.length);
    const theta = Math.sqrt(allParticles.length * Math.PI) * phi;

    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);
    const pos = new THREE.Vector3(x, y, z);
    const dir = pos.clone().normalize();

    const cat = categoryForDir(dir);
    if (cat === 'land') landTargets.push(pos);
    else if (cat === 'desert') desertTargets.push(pos);
    else oceanTargets.push(pos);
  }

  // 타겟 셔플
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  shuffle(landTargets);
  shuffle(oceanTargets);
  shuffle(desertTargets);

  // 그룹에 타겟 할당
  function assignTargetsToGroup(groupParticles, primary, backups) {
    const targets = [];
    let pi = 0;
    while (targets.length < groupParticles.length && pi < primary.length) {
      targets.push(primary[pi++]);
    }
    const backupPool = backups.flat();
    let bi = 0;
    while (targets.length < groupParticles.length && bi < backupPool.length) {
      targets.push(backupPool[bi++]);
    }
    while (targets.length < groupParticles.length && targets.length > 0) {
      targets.push(targets[targets.length - 1]);
    }
    groupParticles.forEach((p, idx) => {
      p.userData.spherePosition = targets[idx] ? targets[idx].clone() : new THREE.Vector3(0, 0, radius);
    });
  }

  assignTargetsToGroup(greenGroup.particles, landTargets,  [oceanTargets, desertTargets]);
  assignTargetsToGroup(blueGroup.particles,  oceanTargets, [landTargets, desertTargets]);
  assignTargetsToGroup(redGroup.particles,   desertTargets,[landTargets, oceanTargets]);
}

// ==================== 파티클 업데이트 ====================
function updateParticleGroup(particleGroup, formationFunc, isHovered) {
  particleGroup.particles.forEach((particle, i) => {
    let targetPos = null;

    if (isRotating) {
      if (particle.userData.spherePosition) {
        const rotated = particle.userData.spherePosition.clone();
        rotated.applyEuler(sphereRotation);
        targetPos = rotated.add(sphereCenter); // 흰 점(중심) 기준으로 고정
      }
    } else if (isHovered) {
      const formation = formationFunc(i, particleGroup.particles.length);
      targetPos = formation.add(particle.userData.basePosition);
    } else {
      targetPos = particle.userData.basePosition.clone().add(particle.userData.scatteredOffset);
    }

    if (targetPos) {
      const lerpFactor = isRotating ? 0.05 : 0.08; // 구로 모일 때 좀 더 빠르게
      particle.position.lerp(targetPos, lerpFactor);
    }
  });
}

// ==================== 구체 회전 제어 ====================
window.addEventListener('mousedown', (e) => {
  if (isRotating) {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
    autoRotateSpeed = 0; // 드래그 중 자동회전 정지
  }
});
window.addEventListener('mouseup', () => { isDragging = false; });
window.addEventListener('mousemove', (e) => {
  if (isRotating && isDragging) {
    const dx = e.clientX - previousMousePosition.x;
    const dy = e.clientY - previousMousePosition.y;
    sphereRotation.y += dx * 0.01;
    sphereRotation.x += dy * 0.01;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  }
});

// ==================== 애니메이션 루프 ====================
function animate() {
  requestAnimationFrame(animate);

  // 최종 모드면 cameraZ 고정
  if (finalSphereStarted && finalCameraZ !== null) {
    cameraZ = finalCameraZ;
  }
  camera.position.z += (cameraZ - camera.position.z) * 0.05;

  if (!isRotating) {
    // 흰 점이 마우스에 붙도록 보간 없이 직접 위치 지정
    const cursorZ = camera.position.z - 3;
    const mouseAtZ = getMouseWorldAtZ(cursorZ);
    cursorDot.position.copy(mouseAtZ);

    // 호버 체크 및 업데이트
    const greenHovered = checkHover(greenGroup, camera.position.z);
    const blueHovered  = checkHover(blueGroup,  camera.position.z);
    const redHovered   = checkHover(redGroup,   camera.position.z);

    updateParticleGroup(greenGroup, getCubeFormation, greenHovered);
    updateParticleGroup(blueGroup,  getWaveFormation, blueHovered);
    updateParticleGroup(redGroup,   getPyramidFormation, redHovered);
  } else {
    // 구체 모드: 흰 점(중심) 화면 중앙 유지
    sphereCenter.set(0, 0, camera.position.z - 3);
    cursorDot.position.copy(sphereCenter);

    // 자동 회전
    if (!isDragging) {
      sphereRotation.y += autoRotateSpeed;
      autoRotateSpeed = Math.min(autoRotateSpeed + 0.00005, 0.002);
    }

    updateParticleGroup(greenGroup, getCubeFormation, false);
    updateParticleGroup(blueGroup,  getWaveFormation, false);
    updateParticleGroup(redGroup,   getPyramidFormation, false);
  }

  renderer.render(scene, camera);
}

// ==================== 반응형 ====================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 시작
animate();
