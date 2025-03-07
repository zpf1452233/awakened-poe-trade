<template>
  <div class="flex flex-col overflow-hidden h-full">
    <div class="p-1 flex">
      <input :placeholder="t('Search') + '...'" v-model="search" class="bg-gray-900 rounded px-1">
      <ui-toggle v-model="onlySelected" class="mx-2">{{ t('Only selected') }}</ui-toggle>
      <ui-toggle v-model="showNewStats" class="ml-12">{{ t('Show icon for new mods') }}</ui-toggle>
    </div>
    <div class="flex items-baseline py-1 shadow">
      <div class="flex-1 px-2 leading-none">{{ t('Stat (found: {0})', [filteredStats.length]) }}</div>
      <div class="flex gap-x-1 text-center items-center" style="padding-right: calc(0.875rem + 2.350rem);">
        <i class="w-8 py-1 bg-orange-600 fas fa-exclamation-triangle"></i>
        <i class="w-8 py-1 bg-red-700 fas fa-skull-crossbones"></i>
        <i class="w-8 py-1 bg-green-700 fas fa-check"></i>
      </div>
    </div>
    <virtual-scroll
      class="flex-1"
      style="overflow-y: scroll;"
      :items="filteredStats"
      :item-height="2 * fontSize"
      v-slot="props"
    >
      <maps-stat-entry
        :style="{ position: 'absolute', top: `${props.top}px` }"
        :matcher="props.item"
        :selected-stats="selectedStats" />
    </virtual-scroll>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { configProp, findWidget } from '../utils'
import type { ItemCheckWidget } from '@/web/overlay/interfaces'
import { STATS_ITERATOR, STAT_BY_MATCH_STR } from '@/assets/data'
import MapsStatEntry from './MapsStatEntry.vue'
import VirtualScroll from '../../ui/VirtualScroll.vue'
import type { MapStatMatcher } from './interfaces'

function statToShowOrder (stat: Omit<MapStatMatcher, 'outdated'>) {
  if (stat.heist) {
    return 1
  } else {
    return 0
  }
}

export default defineComponent({
  components: { MapsStatEntry, VirtualScroll },
  props: configProp(),
  setup (props) {
    const search = ref('')
    const onlySelected = ref(false)

    const widget = computed(() => findWidget<ItemCheckWidget>('item-check', props.config)!)

    const statList = computed(() => {
      const out: Array<{ str: string, searchStr: string, heist: boolean }> = []
      for (const stat of STATS_ITERATOR('AreaMods')) {
        if (!stat.fromAreaMods && !stat.fromHeistAreaMods) continue

        for (const c of stat.matchers) {
          out.push({
            str: c.string,
            searchStr: c.string.toLowerCase(),
            heist: (stat.fromHeistAreaMods && !stat.fromAreaMods) || false
          })
        }
      }
      out.sort((a, b) => {
        return (statToShowOrder(a) - statToShowOrder(b)) || a.str.localeCompare(b.str)
      })
      return out
    })

    const selectedMatchers = computed(() => {
      return new Set(
        widget.value.maps.selectedStats
          .filter(entry => entry.decision !== 'seen')
          .map(entry => entry.matcher))
    })

    const showNewStats = computed<boolean>({
      get () { return widget.value.maps.showNewStats },
      set (value) { widget.value.maps.showNewStats = value }
    })

    const hasOutdatedTranslation = computed<MapStatMatcher[]>(() => {
      return widget.value.maps
        .selectedStats
        .filter(entry =>
          entry.decision !== 'seen' &&
          STAT_BY_MATCH_STR(entry.matcher) == null)
        .map(entry => ({ str: entry.matcher, heist: undefined, outdated: true }))
    })

    const { t } = useI18n()

    return {
      t,
      search,
      onlySelected,
      showNewStats,
      filteredStats: computed<MapStatMatcher[]>(() => {
        const q = search.value.toLowerCase().split(' ')

        const filtered = statList.value
          .filter(stat =>
            q.every(part => stat.searchStr.includes(part)) &&
            (onlySelected.value
              ? selectedMatchers.value.has(stat.str)
              : true)
          )
          .map(({ str, heist }) => ({ str, heist, outdated: false }))

        return [
          ...hasOutdatedTranslation.value,
          ...filtered
        ]
      }),
      selectedStats: computed(() => widget.value.maps.selectedStats),
      fontSize: computed(() => props.config.fontSize)
    }
  }
})
</script>

<i18n>
{
  "ru": {
    "Only selected": "Только выбранные",
    "Stat (found: {0})": "Свойства (найдено: {0})",
    "Show icon for new mods": "Иконка у новых модов"
  }
}
</i18n>
