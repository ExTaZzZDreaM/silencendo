import { useCallback, useState } from "react"
import { ArrowRight } from "lucide-react"
import { Trans } from "react-i18next"

import type { ProviderSettings } from "@roo-code/types"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { validateApiConfiguration } from "@src/utils/validate"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import ApiOptions from "../settings/ApiOptions"
import { Tab, TabContent } from "../common/Tab"

import RooHero from "./RooHero"

const WelcomeViewProvider = () => {
	const {
		apiConfiguration,
		currentApiConfigName,
		setApiConfiguration,
		uriScheme,
	} = useExtensionState()
	const { t } = useAppTranslation()
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

	// Memoize the setApiConfigurationField function to pass to ApiOptions
	const setApiConfigurationFieldForApiOptions = useCallback(
		<K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => {
			setApiConfiguration({ [field]: value })
		},
		[setApiConfiguration], // setApiConfiguration from context is stable
	)

	const handleGetStarted = useCallback(() => {
		// Always use Ollama configuration
		const baseUrl =
			apiConfiguration?.ollamaBaseUrl && apiConfiguration?.ollamaBaseUrl.trim() !== ""
				? apiConfiguration.ollamaBaseUrl
				: "http://localhost:11434"

		const config: ProviderSettings = { apiProvider: "ollama", ...(apiConfiguration || {}), ollamaBaseUrl: baseUrl }

		if (!config.ollamaModelId) {
			setErrorMessage(t("settings:validation.modelId"))
			return
		}

		const error = validateApiConfiguration(config)

		if (error) {
			setErrorMessage(error)
			return
		}

		setErrorMessage(undefined)
		vscode.postMessage({
			type: "upsertApiConfiguration",
			text: currentApiConfigName,
			apiConfiguration: config,
		})
	}, [apiConfiguration, currentApiConfigName, setErrorMessage, t])

	return (
		<Tab>
			<TabContent className="flex flex-col gap-5 p-6 justify-center">
				<RooHero />
				<h2 className="mt-0 mb-0 text-xl">{t("welcome:landing.greeting")}</h2>

				<div className="space-y-3 leading-normal">
					<p className="text-base text-vscode-foreground">
						<Trans i18nKey="welcome:landing.introduction" />
					</p>
					<p className="mb-0 font-semibold">
						<Trans i18nKey="welcome:landing.accountMention" />
					</p>
				</div>

				<div className="border border-vscode-panel-border rounded-lg p-4">
					<ApiOptions
						fromWelcomeView
						apiConfiguration={apiConfiguration || {}}
						uriScheme={uriScheme}
						setApiConfigurationField={setApiConfigurationFieldForApiOptions}
						errorMessage={errorMessage}
						setErrorMessage={setErrorMessage}
					/>
				</div>

				<div className="mt-1 flex gap-2">
					<Button onClick={handleGetStarted} variant="primary">
						{t("welcome:landing.getStarted")}
						<ArrowRight className="size-4 ml-2" />
					</Button>
				</div>
			</TabContent>
		</Tab>
	)
}

export default WelcomeViewProvider
