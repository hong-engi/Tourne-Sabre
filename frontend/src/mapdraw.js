import sword from './sword.png'

export const canvasSize = 1000
const center = canvasSize / 2
const arenaRadius = 400
export const itemViewRadius = 550
const tau = 2 * Math.PI

const swordImage = new Image()
swordImage.src = sword

let mask
let arrow
function preparePaths() {
  mask = new Path2D()
  mask.rect(0, 0, canvasSize, canvasSize)
  mask.arc(center, center, arenaRadius, 0, tau)
  arrow = new Path2D()
  arrow.moveTo(arenaRadius, 0)
  arrow.lineTo(arenaRadius - 20, -20)
  arrow.lineTo(arenaRadius - 20, 20)
  arrow.closePath()
}

function circle(ctx, x, y, radius, color) {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, tau)
  ctx.fillStyle = color
  ctx.fill()
  ctx.stroke()
}

function label(ctx, text, size, x, y) {
  ctx.font = `${size}px system-ui`
  ctx.fillText(text, x - ctx.measureText(text).width / 2, y)
}

function drawPlayer(ctx, player, camera) {
  const dx = player.x - camera.x
  const dy = player.y - camera.y
  const distanceSquared = dx * dx + dy * dy
  const self = player._id === camera._id
  const x = center + dx
  const y = center + dy
  if (distanceSquared > (arenaRadius + player.r) ** 2) {
    ctx.fillStyle = player.color
    ctx.save()
    ctx.translate(center, center)
    ctx.rotate(Math.atan2(dy, dx))
    ctx.fill(arrow)
    ctx.restore()
  } else {
    ctx.lineWidth = 1
    circle(ctx, x, y, player.r, self ? 'red' : player.color)
    ctx.fillStyle = self ? 'white' : 'black'
    label(ctx, player.name, player.r * 0.6, x, y + player.r * 0.2)
    label(ctx, `${player.lv} lv`, Math.max(10, player.r * 0.4), x, y + player.r * 0.72)

    ctx.fillStyle = '#77FF77'
    ctx.fillRect(x - player.r, y + player.r + 3, 2 * player.r * player.hp / player.hpmax, 10)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.fillRect(x - player.r, y + player.r + 3, 2 * player.r, 10)
  }

  if (swordImage.naturalWidth && distanceSquared <= (arenaRadius + player.r + player.sw_r) ** 2) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(-player.sw_angle)
    ctx.drawImage(swordImage, -player.sw_w / 2, -player.r - player.sw_r - player.sw_h / 2,
      player.sw_w, player.sw_h)
    ctx.restore()
  }
}

export function draw(ctx, state) {
  if (!mask) preparePaths()
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvasSize, canvasSize)
  if (state) {
    const { me, players, items } = state
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 0.5
    for (const item of items) {
      const dx = item.pos.x - me.x
      const dy = item.pos.y - me.y
      if (dx * dx + dy * dy < itemViewRadius ** 2) {
        circle(ctx, center + dx, center + dy, item.r, item.color)
      }
    }
    drawPlayer(ctx, me, me)
    for (const player of players) drawPlayer(ctx, player, me)
  }

  ctx.fillStyle = 'black'
  ctx.fill(mask, 'evenodd')
  if (state) {
    ctx.font = '20px system-ui'
    ctx.fillStyle = 'green'
    ctx.fillText(`(${Math.round(state.me.x)},${Math.round(state.me.y)})`, 100, 200)
  }
}
