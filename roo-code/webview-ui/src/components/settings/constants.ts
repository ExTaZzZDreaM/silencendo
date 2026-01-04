import type { ProviderName, ModelInfo } from "@roo-code/types"

// Only Ollama is supported; no static model metadata is needed.
export const MODELS_BY_PROVIDER: Partial<Record<ProviderName, Record<string, ModelInfo>>> = {}

export const PROVIDERS = [
	{ value: "ollama", label: "Ollama" },
]
