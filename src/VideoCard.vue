<template>
  <article class="card" :class="{ 'card--watched': isWatched }" @click="$emit('play', video)">
    <div class="card-thumb">
      <img :src="thumbnail" :alt="video.snippet.title" loading="lazy" />
      <div class="card-overlay">
        <div class="play-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path v-if="isCompleted" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
            <path v-else d="M8 5v14l11-7z"/>
          </svg>
        </div>
      </div>
      <!-- Badges -->
      <div v-if="isCompleted" class="thumb-badge thumb-badge--done">✓ Watched</div>
      <div v-else-if="isInProgress" class="thumb-badge thumb-badge--resume">Resume</div>
      <!-- Progress bar -->
      <div v-if="isInProgress || isCompleted" class="thumb-progress">
        <div class="thumb-progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <!-- Save actions (top-right) -->
      <div class="card-actions" @click.stop>
        <button
          class="card-action-btn"
          :class="{ active: isWatchLater }"
          @click="$emit('toggle-watch-later', video)"
          title="Watch Later"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>
          </svg>
        </button>
        <button
          class="card-action-btn"
          :class="{ active: isBookmarked }"
          @click="$emit('toggle-bookmark', video)"
          title="Bookmark"
        >
          <svg viewBox="0 0 24 24" :fill="isBookmarked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="card-body">
      <p class="card-channel">{{ video.snippet.channelTitle }}</p>
      <h3 class="card-title">{{ video.snippet.title }}</h3>
      <p class="card-desc">{{ truncatedDesc }}</p>
      <div class="card-footer">
        <time class="card-date">{{ formattedDate }}</time>
        <span v-if="progressLabel" class="card-progress-label">{{ progressLabel }}</span>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  video:        { type: Object, required: true },
  progress:     { type: Object, default: null },
  isWatchLater: { type: Boolean, default: false },
  isBookmarked: { type: Boolean, default: false }
})

defineEmits(['play', 'toggle-watch-later', 'toggle-bookmark'])

const thumbnail = computed(() => {
  const t = props.video.snippet.thumbnails
  return (t.maxres || t.high || t.medium || t.default).url
})

const truncatedDesc = computed(() => {
  const d = props.video.snippet.description || ''
  return d.length > 120 ? d.slice(0, 120).trimEnd() + '…' : d
})

const formattedDate = computed(() => {
  const diff = Math.floor((Date.now() - new Date(props.video.snippet.publishedAt)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7)   return `${diff} days ago`
  if (diff < 30)  return `${Math.floor(diff / 7)} weeks ago`
  if (diff < 365) return `${Math.floor(diff / 30)} months ago`
  return `${Math.floor(diff / 365)} years ago`
})

const progressPercent = computed(() => {
  if (!props.progress?.totalSec) return 0
  return Math.min(100, (props.progress.watchedSec / props.progress.totalSec) * 100)
})

const isInProgress = computed(() => props.progress?.watchedSec > 4 && progressPercent.value < 90)
const isCompleted  = computed(() => props.progress?.watchedSec > 4 && progressPercent.value >= 90)
const isWatched    = computed(() => isInProgress.value || isCompleted.value)

function fmt(sec) {
  if (!sec || sec < 60) return `${Math.floor(sec || 0)}s`
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60)
  return `${m}m${s > 0 ? ' ' + s + 's' : ''}`
}

const progressLabel = computed(() => {
  if (!props.progress?.totalSec) return null
  if (isCompleted.value)  return `Watched · ${fmt(props.progress.totalSec)}`
  if (isInProgress.value) return `${fmt(props.progress.watchedSec)} of ${fmt(props.progress.totalSec)}`
  return null
})
</script>

<style scoped>
.card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 4px; overflow: hidden; cursor: pointer; display: flex; flex-direction: column; transition: border-color .2s ease, transform .2s ease; }
.card:hover { border-color: var(--accent); transform: translateY(-2px); }
.card--watched { opacity: .72; }
.card--watched:hover { opacity: 1; }

.card-thumb { position: relative; aspect-ratio: 16/9; overflow: hidden; background: var(--thumb-bg); }
.card-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .35s ease; }
.card:hover .card-thumb img { transform: scale(1.03); }

.card-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0); display: flex; align-items: center; justify-content: center; transition: background .2s ease; }
.card:hover .card-overlay { background: rgba(0,0,0,.35); }

.play-icon { width: 50px; height: 50px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; color: #fff; opacity: 0; transform: scale(.8); transition: opacity .2s ease, transform .2s ease; }
.play-icon svg { width: 24px; height: 24px; margin-left: 3px; }
.card:hover .play-icon { opacity: 1; transform: scale(1); }

.thumb-badge { position: absolute; top: 8px; left: 8px; font-size: .6rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; padding: 3px 8px; border-radius: 3px; }
.thumb-badge--done   { background: rgba(0,0,0,.72); color: var(--text-muted); }
.thumb-badge--resume { background: var(--accent); color: #0e0e10; }

.thumb-progress { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: rgba(255,255,255,.15); }
.thumb-progress-fill { height: 100%; background: var(--accent); transition: width .4s ease; }

/* Save action buttons */
.card-actions { position: absolute; top: 6px; right: 6px; display: flex; gap: 4px; opacity: 0; transition: opacity .15s; }
.card:hover .card-actions { opacity: 1; }
.card-action-btn { width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(0,0,0,.65); backdrop-filter: blur(4px); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .15s, color .15s; }
.card-action-btn svg { width: 14px; height: 14px; }
.card-action-btn:hover { background: rgba(0,0,0,.9); }
.card-action-btn.active { background: var(--accent); color: #0e0e10; }

.card-body { padding: 14px; display: flex; flex-direction: column; gap: 5px; flex: 1; }
.card-channel { font-size: .66rem; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--accent); margin: 0; }
.card-title { font-family: var(--font-display); font-size: .94rem; font-weight: 500; line-height: 1.4; color: var(--text-primary); margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-desc { font-size: .76rem; line-height: 1.55; color: var(--text-muted); margin: 0; flex: 1; }
.card-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
.card-date { font-size: .68rem; color: var(--text-faint); letter-spacing: .03em; }
.card-progress-label { font-size: .65rem; color: var(--accent); font-weight: 500; background: var(--accent-dim); border-radius: 3px; padding: 2px 7px; white-space: nowrap; }
</style>
