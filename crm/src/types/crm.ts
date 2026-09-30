import type { PermissionCode } from '../contexts/AuthContext'

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'relation' | 'multi_relation' | 'boolean'

export type RelationConfig = {
  table: string
  valueKey?: string
  labelKeys: string[]
  filter?: Record<string, string | boolean>
}

export type JunctionConfig = {
  table: string
  parentKey: string
  relationKey: string
}

export type FieldConfig = {
  key: string
  label: string
  type?: FieldType
  required?: boolean
  placeholder?: string
  options?: string[]
  relation?: RelationConfig
  junction?: JunctionConfig
  width?: 'full' | 'half'
}

export type ColumnConfig = {
  key: string
  label: string
  format?: 'date' | 'datetime' | 'currency' | 'boolean' | 'status'
}

export type EntityConfig = {
  table: string
  title: string
  singular: string
  description: string
  columns: ColumnConfig[]
  fields: FieldConfig[]
  searchKeys: string[]
  orderBy?: string
  softDelete?: boolean
  hasUpdatedBy?: boolean
  hasCreatedBy?: boolean
  canCreate?: boolean
  canEdit?: boolean
  canDeactivate?: boolean
  writePermission?: PermissionCode
  deactivatePermission?: PermissionCode
  detailBasePath?: string
}

export type RowData = Record<string, unknown>
