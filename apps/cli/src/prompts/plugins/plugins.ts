import * as p from '@clack/prompts'
import pc from 'picocolors'
import { type OfficialPlugin, officialPlugins } from '../../lib/plugins'
import { cancelable } from '../cancel'

export async function promptPlugins(): Promise<OfficialPlugin[]> {
  if (officialPlugins.length === 0) return []
  const ids = cancelable(
    await p.multiselect<string>({
      message: `Add official plugins? ${pc.dim('(space to toggle, enter to confirm)')}`,
      required: false,
      initialValues: officialPlugins
        .filter((plugin) => plugin.recommended)
        .map((plugin) => plugin.id),
      options: officialPlugins.map((plugin) => ({
        value: plugin.id,
        label: plugin.label,
        hint: plugin.hint,
      })),
    }),
  )
  return officialPlugins.filter((plugin) => ids.includes(plugin.id))
}
