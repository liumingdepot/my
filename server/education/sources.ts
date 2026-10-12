/**
 * 教育源（写死，不入库）。
 * 数据源：server/education/seed.ts —— 来自 TVBox csp_Bili ext JSON（cookie 已剥离）。
 * 数据基本不变，故不保留后台管理 / 数据库，直接在接口层读这份常量。
 */

import { EDUCATION_SEEDS } from './seed.js'

export type EducationClass = {
  typeName: string
  typeId: string
}

export type EducationFilterOption = {
  n: string
  v: string
}

export type EducationFilter = {
  key: string
  name: string
  value: EducationFilterOption[]
}

export type EducationSource = {
  id: string
  name: string
  sortOrder: number
  classes: EducationClass[]
  filter: Record<string, EducationFilter[]>
}

type SeedClass = { type_name?: string; type_id?: string }
type SeedFilterItem = { key?: string; name?: string; value?: Array<{ n?: string; v?: string }> }

function normalizeClasses(raw: unknown): EducationClass[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const obj = (item && typeof item === 'object' ? item : {}) as SeedClass
      return {
        typeName: String(obj.type_name ?? '').trim(),
        typeId: String(obj.type_id ?? '').trim(),
      }
    })
    .filter((item) => item.typeName && item.typeId)
}

function normalizeFilter(raw: unknown): Record<string, EducationFilter[]> {
  const filter: Record<string, EducationFilter[]> = {}
  if (!raw || typeof raw !== 'object') return filter
  for (const [key, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue
    filter[key] = list
      .map((item) => {
        const obj = (item && typeof item === 'object' ? item : {}) as SeedFilterItem
        return {
          key: String(obj.key ?? '').trim(),
          name: String(obj.name ?? '').trim(),
          value: (Array.isArray(obj.value) ? obj.value : [])
            .map((opt) => {
              const o = (opt && typeof opt === 'object' ? opt : {}) as { n?: string; v?: string }
              return { n: String(o.n ?? '').trim(), v: String(o.v ?? '').trim() }
            })
            .filter((opt) => opt.n && opt.v),
        }
      })
      .filter((item) => item.key && item.name && item.value.length)
  }
  return filter
}

const SOURCES: EducationSource[] = EDUCATION_SEEDS.map((seed, index) => ({
  id: `education-${index + 1}`,
  name: seed.name,
  sortOrder: index + 1,
  classes: normalizeClasses(seed.ext.classes),
  filter: normalizeFilter(seed.ext.filter),
})).sort((a, b) => a.sortOrder - b.sortOrder)

export function listEducationSources(): EducationSource[] {
  return SOURCES
}

export function findEducationSourceById(id: string): EducationSource | null {
  const key = id.trim()
  if (!key) return null
  return SOURCES.find((item) => item.id === key) ?? null
}