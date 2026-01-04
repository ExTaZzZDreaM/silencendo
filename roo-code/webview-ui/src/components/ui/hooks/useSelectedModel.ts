import { type ProviderName, type ProviderSettings, ollamaDefaultModelId } from "@roo-code/types"
import type { ModelRecord } from "@roo/api"

import { useOllamaModels } from "./useOllamaModels"

/**
 * Simplified model selector: Ollama only.
 */
export const useSelectedModel = (apiConfiguration?: ProviderSettings) => {
	const provider: ProviderName = "ollama"
	const ollamaModelId = apiConfiguration?.ollamaModelId
	const ollamaModels = useOllamaModels(ollamaModelId)

	const { id, info } =
		apiConfiguration && !ollamaModels.isLoading && !ollamaModels.isError
			? getSelectedModel({
					apiConfiguration,
					ollamaModels: (ollamaModels.data || undefined) as ModelRecord | undefined,
				})
			: { id: ollamaDefaultModelId, info: undefined }

	return {
		provider,
		id,
		info,
		isLoading: ollamaModels.isLoading,
		isError: ollamaModels.isError,
	}
}

function getSelectedModel({
	apiConfiguration,
	ollamaModels,
}: {
	apiConfiguration: ProviderSettings
	ollamaModels: ModelRecord | undefined
}): { id: string; info: ModelRecord[string] | undefined } {
	const defaultModelId = ollamaDefaultModelId
	const id = getValidatedModelId(apiConfiguration.ollamaModelId, ollamaModels, defaultModelId)
	const info = ollamaModels?.[id]
	return { id, info }
}

function getValidatedModelId(
	configuredId: string | undefined,
	availableModels: ModelRecord | undefined,
	defaultModelId: string,
): string {
	return configuredId && availableModels?.[configuredId] ? configuredId : defaultModelId
}
