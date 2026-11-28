export const LEVEL_UP_DURATION = 1500;

const TAU = Math.PI * 2;
const clamp = value => Math.max(0, Math.min(1, value));
const easeOut = value => 1 - (1 - clamp(value)) ** 3;
const opacity = elapsed => 1 - clamp((elapsed - 1050) / (LEVEL_UP_DURATION - 1050));

function ring(ctx, radius, alpha, width) {
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.ellipse(0, 25, radius, radius * .34, 0, 0, TAU);
  ctx.strokeStyle = '#ffe4a4';
  ctx.lineWidth = width;
  ctx.stroke();
}

// These shapes animate at display resolution, independently of the pixel sprites.
export function drawLevelUpAura(ctx, x, y, elapsed, reduced, seed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= opacity(elapsed);

  const glow = ctx.createRadialGradient(0, 20, 8, 0, 20, 100);
  glow.addColorStop(0, '#ffe4a438');
  glow.addColorStop(1, '#ffe4a400');
  ctx.fillStyle = glow;
  ctx.fillRect(-100, -80, 200, 200);

  if (reduced) {
    ring(ctx, 52, .8, 2.5);
    ctx.restore();
    return;
  }

  // A rising column and two ground ripples make this read as growth, rather
  // than a damaging explosion like the nova augmentation.
  const column = ctx.createLinearGradient(0, -138, 0, 30);
  column.addColorStop(0, '#ffe4a400');
  column.addColorStop(.65, '#ffe4a42e');
  column.addColorStop(1, '#ffe4a45c');
  ctx.save();
  ctx.globalAlpha *= clamp(elapsed / 90) * (1 - clamp((elapsed - 400) / 550));
  ctx.fillStyle = column;
  ctx.beginPath();
  ctx.moveTo(-20, -138); ctx.lineTo(20, -138);
  ctx.lineTo(52, 30); ctx.lineTo(-52, 30);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  for (let i = 0; i < 2; i++) {
    const age = (elapsed - i * 180) / 650;
    if (age < 0 || age >= 1) continue;
    ctx.save();
    ring(ctx, 30 + easeOut(age) * 80, (1 - age) * .9, 3 - age * 2);
    ctx.restore();
  }

  for (let i = 0; i < 18; i++) {
    const age = (elapsed - (i % 6) * 55) / 850;
    if (age < 0 || age >= 1) continue;
    const angle = seed + i * 2.39996;
    const radius = 24 + easeOut(age) * (26 + i % 4 * 8);
    const px = Math.cos(angle) * radius;
    const py = 20 + Math.sin(angle) * radius * .3 - easeOut(age) * (70 + i % 3 * 20);
    const size = (i % 3 === 0 ? 4 : 2.5) * (1 - age * .6);
    ctx.save();
    ctx.globalAlpha *= Math.min(1, age * 10) * (1 - age);
    ctx.fillStyle = i % 3 === 0 ? '#fff8df' : '#f2cc76';
    ctx.fillRect(px - size, py - .9, size * 2, 1.8);
    ctx.fillRect(px - .9, py - size, 1.8, size * 2);
    ctx.restore();
  }
  ctx.restore();
}
