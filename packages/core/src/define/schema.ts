import type { Schemas } from '@shopware/api-client/admin-api-types'
import type { Ctx } from './ctx'

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

type WritableKeys<T> = {
  [K in keyof T]-?: K extends NoiseField ? never : IsWritable<T, K> extends true ? K : never
}[keyof T]

type AssocObject<T> = ('id' extends keyof T ? { id?: string } : object) & {
  [K in keyof T]?: unknown
}

type AssocElement<U> = U extends object ? AssocObject<U> : U

type Field<T> = T extends (infer U)[]
  ? Producible<AssocElement<U>>[]
  : T extends string | number | boolean | null
    ? T
    : T extends object
      ? AssocObject<T>
      : T

type Producible<T> = Field<T> | ((ctx: Ctx) => Field<T>)

type RecordShape<E extends EntityName> = { $key?: string } & {
  [K in WritableKeys<SchemaOf<E>>]?: Producible<SchemaOf<E>[K]>
}

export type DefineRecord<E extends EntityName> = RecordShape<E> | ((ctx: Ctx) => RecordShape<E>)
