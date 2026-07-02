import type { Schemas } from '@shopware/api-client/admin-api-types'
import type { MediaRecord } from '../shopware/media'
import type { Ctx } from './ctx'
import type { AnyToken } from './tokens'

type Words<
  S extends string,
  Cur extends string = '',
  Acc extends string[] = [],
> = S extends `${infer H}${infer T}`
  ? H extends Uppercase<H>
    ? Cur extends ''
      ? Words<T, H, Acc>
      : Words<T, H, [...Acc, Cur]>
    : Words<T, `${Cur}${H}`, Acc>
  : Cur extends ''
    ? Acc
    : [...Acc, Cur]

type JoinSnake<T extends string[]> = T extends [infer A extends string, ...infer R extends string[]]
  ? R extends []
    ? Lowercase<A>
    : `${Lowercase<A>}_${JoinSnake<R>}`
  : ''

type SnakeOfPascal<S extends string> = JoinSnake<Words<S>>

type EntityKey = {
  [K in keyof Schemas]: K extends `${string}JsonApi`
    ? never
    : K extends Capitalize<K & string>
      ? Schemas[K] extends { id?: string }
        ? K
        : never
      : never
}[keyof Schemas] &
  string

type EntityNameToKey = { [K in EntityKey as SnakeOfPascal<K>]: K }

export type EntityName = keyof EntityNameToKey & string

type SchemaOf<E extends EntityName> = Schemas[EntityNameToKey[E]]

type Equal<X, Y> =
  (<G>() => G extends X ? 1 : 2) extends <G>() => G extends Y ? 1 : 2 ? true : false

type IsWritable<T, K extends keyof T> = Equal<{ [Q in K]: T[K] }, { -readonly [Q in K]: T[K] }>

type NoiseField = 'extensions' | 'translated' | 'customFields' | `${string}Ro`

export interface RecordExtensions {}

type RecordExtensionsField = {
  [K in keyof RecordExtensions]?: Producible<RecordExtensions[K]>
}

type WritableKeys<T> = {
  [K in keyof T]-?: K extends NoiseField ? never : IsWritable<T, K> extends true ? K : never
}[keyof T]

type AssocObject<T> = ('id' extends keyof T ? { id?: string | AnyToken } : object) & {
  [K in keyof T]?: unknown
}

type AssocElement<U> = U extends object ? AssocObject<U> : U

type Field<T> = T extends (infer U)[]
  ? Producible<AssocElement<U>>[] | AnyToken
  : T extends string | number | boolean | null
    ? T | AnyToken
    : T extends object
      ? AssocObject<T>
      : T

type Producible<T> = Field<T> | ((ctx: Ctx) => Field<T>)

type ExtensionsKey = keyof RecordExtensions extends never ? never : 'extensions'

type MediaAuthored = MediaRecord | AnyToken
type MediaAuthoring = {
  cover?: Producible<MediaAuthored>
  gallery?: Producible<MediaAuthored[]>
}
type MediaAuthoringKey = 'cover' | 'gallery'
type HasCover<E extends EntityName> = 'coverId' extends keyof SchemaOf<E> ? true : false

type BaseRecordShape<E extends EntityName> = {
  [K in
    | Exclude<WritableKeys<SchemaOf<E>>, MediaAuthoringKey>
    | '$key'
    | ExtensionsKey]?: K extends '$key'
    ? string
    : K extends 'extensions'
      ? RecordExtensionsField
      : K extends WritableKeys<SchemaOf<E>>
        ? Producible<SchemaOf<E>[K]>
        : never
}

type RecordShape<E extends EntityName> =
  HasCover<E> extends true ? BaseRecordShape<E> & MediaAuthoring : BaseRecordShape<E>

export type DefineRecord<E extends EntityName> = RecordShape<E> | ((ctx: Ctx) => RecordShape<E>)

export interface EntityRegistry {}

export type RegistryEntityName = keyof EntityRegistry & string

export type RefPath = `${EntityName}/${string}` | `${RegistryEntityName}/${string}`

type AuthoredField<T> = T extends (ctx: Ctx) => infer R
  ? (ctx: Ctx) => R
  : T | AnyToken | ((ctx: Ctx) => T | AnyToken)

type RegistryRecordShape<E extends RegistryEntityName> = { $key?: string } & {
  [K in keyof EntityRegistry[E] as Exclude<K, '$key'>]: AuthoredField<EntityRegistry[E][K]>
}

type RegistryRecord<E extends RegistryEntityName> =
  | RegistryRecordShape<E>
  | ((ctx: Ctx) => RegistryRecordShape<E>)

export type RecordFor<E extends EntityName | RegistryEntityName> = E extends EntityName
  ? DefineRecord<E>
  : E extends RegistryEntityName
    ? RegistryRecord<E>
    : never
