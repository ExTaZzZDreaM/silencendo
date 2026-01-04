import React, { useEffect } from "react"

import type { ProviderSettings } from "@roo-code/types"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { validateApiConfigurationExcludingModelErrors } from "@src/utils/validate"
import { ApiErrorMessage } from "./ApiErrorMessage"
import { Ollama } from "./providers"

export interface ApiOptionsProps {
	uriScheme: string | undefined
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	fromWelcomeView?: boolean
	errorMessage: string | undefined
	setErrorMessage: React.Dispatch<React.SetStateAction<string | undefined>>
}

const ApiOptions = ({ apiConfiguration, setApiConfigurationField, errorMessage, setErrorMessage }: ApiOptionsProps) => {
	const { t } = useAppTranslation()

	// Always force Ollama as the provider.
	useEffect(() => {
		if (apiConfiguration.apiProvider !== "ollama") {
			setApiConfigurationField("apiProvider", "ollama", false)
		}
	}, [apiConfiguration.apiProvider, setApiConfigurationField])

	// Validate configuration on changes.
	useEffect(() => {
		const validation = validateApiConfigurationExcludingModelErrors(apiConfiguration)
		setErrorMessage(validation)
	}, [apiConfiguration, setErrorMessage])

	// Refresh model list on mount.
	useEffect(() => {
		vscode.postMessage({ type: "requestOllamaModels" })
	}, [])

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-1">
				<label className="block font-medium">{t("settings:providers.apiProvider")}</label>
				<div className="text-sm text-vscode-descriptionForeground">{t("settings:providers.ollama.description")}</div>
			</div>

			{errorMessage && <ApiErrorMessage errorMessage={errorMessage} />}

			<Ollama apiConfiguration={apiConfiguration} setApiConfigurationField={setApiConfigurationField} />
		</div>
	)
}

export default React.memo(ApiOptions)
