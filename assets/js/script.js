const canvas = document.getElementById("fireworks");
const ctx = canvas.getContext("2d");

const particles = [];
const bursts = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function createBurst() {
  bursts.push({
    x: randomBetween(80, canvas.width - 80),
    y: randomBetween(80, canvas.height * 0.6),
    life: 0,
    maxLife: 60,
    hue: randomBetween(0, 360),
  });

  const amount = Math.floor(randomBetween(45, 70));
  for (let i = 0; i < amount; i += 1) {
    const angle = randomBetween(0, Math.PI * 2);
    const speed = randomBetween(1.2, 4.3);

    particles.push({
      x: bursts[bursts.length - 1].x,
      y: bursts[bursts.length - 1].y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      decay: randomBetween(0.008, 0.017),
      size: randomBetween(1.2, 3.2),
      hue: bursts[bursts.length - 1].hue + randomBetween(-25, 25),
    });
  }
}

function drawGlow(x, y, hue, alpha, size) {
  ctx.beginPath();
  ctx.fillStyle = `hsla(${hue}, 100%, 65%, ${alpha})`;
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
}

function animate() {
  ctx.fillStyle = "rgba(10, 6, 24, 0.24)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (Math.random() < 0.035) {
    createBurst();
  }

  for (let i = bursts.length - 1; i >= 0; i -= 1) {
    const burst = bursts[i];
    burst.life += 1;

    const ringAlpha = 1 - burst.life / burst.maxLife;
    const ringRadius = burst.life * 1.3;

    ctx.beginPath();
    ctx.strokeStyle = `hsla(${burst.hue}, 100%, 70%, ${ringAlpha * 0.45})`;
    ctx.lineWidth = 2;
    ctx.arc(burst.x, burst.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    if (burst.life >= burst.maxLife) {
      bursts.splice(i, 1);
    }
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.vy += 0.02;
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= p.decay;

    drawGlow(p.x, p.y, p.hue, Math.max(0, p.alpha), p.size);

    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }

  requestAnimationFrame(animate);
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

for (let i = 0; i < 3; i += 1) {
  createBurst();
}

animate();
