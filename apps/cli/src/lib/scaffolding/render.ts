import { Eta } from 'eta'
import {
  pluginReadmeTemplate,
  pluginSourceTemplate,
  pluginTestTemplate,
  projectDataTemplate,
} from './templates'
import type { ScaffoldValues } from './values'

const eta = new Eta({ autoEscape: false, autoTrim: false, rmWhitespace: false })

interface TemplateData {
  name: string
}

function render(template: string, values: ScaffoldValues): string {
  return eta.renderString(template, { name: values.projectName } satisfies TemplateData)
}

export function pluginSource(values: ScaffoldValues): string {
  return render(pluginSourceTemplate, values)
}

export function pluginTest(values: ScaffoldValues): string {
  return render(pluginTestTemplate, values)
}

export function pluginReadme(): string {
  return pluginReadmeTemplate
}

export function projectData(): string {
  return projectDataTemplate
}
