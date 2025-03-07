import { calculatedStatToFilter, FiltersCreationContext } from '../create-stat-filters'
import { calcPropBounds, propAt20Quality, QUALITY_STATS } from './calc-q20'
import { stat, StatBetter } from '@/assets/data'
import { ARMOUR, WEAPON, ItemCategory } from '@/parser/meta'
import { ParsedItem } from '@/parser'
import { ModifierType, StatRoll } from '@/parser/modifiers'
import { FilterTag, InternalTradeId, StatFilter } from '../interfaces'

export function filterItemProp (ctx: FiltersCreationContext) {
  if (ARMOUR.has(ctx.item.category!)) {
    armourProps(ctx)
  }
  if (WEAPON.has(ctx.item.category!)) {
    weaponProps(ctx)
  }
}

export const ARMOUR_STATS = new Set<string>([
  ...QUALITY_STATS.ARMOUR.flat,
  ...QUALITY_STATS.EVASION.flat,
  ...QUALITY_STATS.ENERGY_SHIELD.flat,
  ...QUALITY_STATS.WARD.flat,
  ...QUALITY_STATS.ARMOUR.incr,
  ...QUALITY_STATS.EVASION.incr,
  ...QUALITY_STATS.ENERGY_SHIELD.incr,
  ...QUALITY_STATS.WARD.incr,
  stat('+#% Chance to Block')
])

function armourProps (ctx: FiltersCreationContext) {
  const { item } = ctx

  if (item.armourAR) {
    const totalQ20 = propAt20Quality(item.armourAR, QUALITY_STATS.ARMOUR, item)

    ctx.filters.push(propToFilter({
      ref: 'Armour: #',
      tradeId: 'armour.armour',
      roll: totalQ20,
      disabled: !isSingleAttrArmour(item)
    }, ctx))
  }

  if (item.armourEV) {
    const totalQ20 = propAt20Quality(item.armourEV, QUALITY_STATS.EVASION, item)

    ctx.filters.push(propToFilter({
      ref: 'Evasion Rating: #',
      tradeId: 'armour.evasion_rating',
      roll: totalQ20,
      disabled: !isSingleAttrArmour(item)
    }, ctx))
  }

  if (item.armourES) {
    const totalQ20 = propAt20Quality(item.armourES, QUALITY_STATS.ENERGY_SHIELD, item)

    ctx.filters.push(propToFilter({
      ref: 'Energy Shield: #',
      tradeId: 'armour.energy_shield',
      roll: totalQ20,
      disabled: !isSingleAttrArmour(item)
    }, ctx))
  }

  if (item.armourWARD) {
    const totalQ20 = propAt20Quality(item.armourWARD, QUALITY_STATS.WARD, item)

    ctx.filters.push(propToFilter({
      ref: 'Ward: #',
      tradeId: 'armour.ward',
      roll: totalQ20,
      disabled: !isSingleAttrArmour(item)
    }, ctx))
  }

  if (item.armourBLOCK) {
    const block = calcPropBounds(item.armourBLOCK, { flat: ['+#% Chance to Block'], incr: [] }, item)

    ctx.filters.push(propToFilter({
      ref: 'Block: #%',
      tradeId: 'armour.block',
      roll: block,
      disabled: true
    }, ctx))
  }

  if (
    item.armourAR ||
    item.armourEV ||
    item.armourES ||
    item.armourWARD ||
    item.armourBLOCK
  ) {
    removeUsedStats(ctx, ARMOUR_STATS)
  }
}

export const WEAPON_STATS = new Set<string>([
  ...QUALITY_STATS.PHYSICAL_DAMAGE.flat,
  ...QUALITY_STATS.PHYSICAL_DAMAGE.incr,
  stat('#% increased Attack Speed'),
  stat('#% increased Critical Strike Chance'),

  // stat('Adds # to # Chaos Damage'),
  stat('Adds # to # Lightning Damage'),
  stat('Adds # to # Cold Damage'),
  stat('Adds # to # Fire Damage')
])

function weaponProps (ctx: FiltersCreationContext) {
  const { item } = ctx

  const attackSpeed = calcPropBounds(item.weaponAS!, { incr: ['#% increased Attack Speed'], flat: [] }, item)
  const physQ20 = propAt20Quality(item.weaponPHYSICAL!, QUALITY_STATS.PHYSICAL_DAMAGE, item)
  const pdpsQ20: StatRoll = {
    value: physQ20.value * attackSpeed.value,
    min: physQ20.min * attackSpeed.min,
    max: physQ20.max * attackSpeed.max
  }

  const eleDmg = calcPropBounds(item.weaponELEMENTAL!, {
    flat: ['Adds # to # Lightning Damage', 'Adds # to # Cold Damage', 'Adds # to # Fire Damage'],
    incr: []
  }, item)

  const edps: StatRoll = {
    value: eleDmg.value * attackSpeed.value,
    min: eleDmg.min * attackSpeed.min,
    max: eleDmg.max * attackSpeed.max
  }
  const dps: StatRoll = {
    value: pdpsQ20.value + edps.value,
    min: pdpsQ20.min + edps.min,
    max: pdpsQ20.max + edps.max
  }

  if (item.weaponELEMENTAL) {
    ctx.filters.push(propToFilter({
      ref: 'DPS: #',
      tradeId: 'weapon.total_dps',
      roll: dps,
      disabled: false
    }, ctx))

    ctx.filters.push(propToFilter({
      ref: 'Elemental DPS: #',
      tradeId: 'weapon.elemental_dps',
      roll: edps,
      disabled: (edps.value / dps.value < 0.67),
      hidden: (edps.value / dps.value < 0.67) ? 'Elemental damage is not the main source of DPS' : undefined
    }, ctx))
  }

  ctx.filters.push(propToFilter({
    ref: 'Physical DPS: #',
    tradeId: 'weapon.physical_dps',
    roll: pdpsQ20,
    disabled: !isPdpsImportant(item) || (pdpsQ20.value / dps.value < 0.67),
    hidden: (pdpsQ20.value / dps.value < 0.67) ? 'Physical damage is not the main source of DPS' : undefined
  }, ctx))

  ctx.filters.push(propToFilter({
    ref: 'Attacks per Second: #',
    tradeId: 'weapon.aps',
    roll: attackSpeed,
    dp: true,
    disabled: true
  }, ctx))

  const critChance = calcPropBounds(item.weaponCRIT!, { incr: ['#% increased Critical Strike Chance'], flat: [] }, item)

  ctx.filters.push(propToFilter({
    ref: 'Critical Strike Chance: #%',
    tradeId: 'weapon.crit',
    roll: critChance,
    dp: true,
    disabled: true
  }, ctx))

  if (
    item.weaponAS ||
    item.weaponCRIT ||
    item.weaponELEMENTAL ||
    item.weaponPHYSICAL
  ) {
    removeUsedStats(ctx, WEAPON_STATS)
  }
}

function removeUsedStats (ctx: FiltersCreationContext, stats: Set<string>) {
  ctx.statsByType = ctx.statsByType.filter(m => !stats.has(m.stat.ref))
}

function isSingleAttrArmour (item: ParsedItem) {
  return [
    item.armourAR,
    item.armourEV,
    item.armourES,
    item.armourWARD
  ].filter(value => value != null).length === 1
}

function isPdpsImportant (item: ParsedItem) {
  switch (item.category) {
    case ItemCategory.OneHandedAxe:
    case ItemCategory.TwoHandedAxe:
    case ItemCategory.OneHandedSword:
    case ItemCategory.TwoHandedSword:
    case ItemCategory.Bow:
    case ItemCategory.Warstaff:
      return true
    default:
      return false
  }
}

function propToFilter (opts: {
  ref: string
  tradeId: InternalTradeId
  roll: StatRoll
  dp?: boolean
  disabled?: StatFilter['disabled']
  hidden?: StatFilter['hidden']
}, ctx: FiltersCreationContext): StatFilter {
  const stat = {
    ref: opts.ref,
    matchers: [{ string: opts.ref }],
    trade: { ids: { pseudo: [opts.tradeId] } },
    better: StatBetter.PositiveRoll
  }
  const filter = calculatedStatToFilter({
    stat: stat,
    type: ModifierType.Pseudo,
    sources: [{
      modifier: {
        info: { type: ModifierType.Pseudo, tags: [] },
        stats: []
      },
      stat: {
        stat: stat,
        translation: stat.matchers[0],
        roll: {
          dp: opts.dp ?? false,
          unscalable: false,
          ...opts.roll
        }
      },
      contributes: opts.roll
    }]
  }, ctx.searchInRange, ctx.item)

  filter.tag = FilterTag.Property
  filter.sources = []
  if (opts.disabled != null) filter.disabled = opts.disabled
  if (opts.hidden != null) filter.hidden = opts.hidden

  return filter
}
