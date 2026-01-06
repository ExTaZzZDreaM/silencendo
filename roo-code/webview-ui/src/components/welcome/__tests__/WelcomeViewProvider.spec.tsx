// npx vitest src/components/welcome/__tests__/WelcomeViewProvider.spec.tsx

import { fireEvent, render, screen } from "@/utils/test-utils"

import * as ExtensionStateContext from "@src/context/ExtensionStateContext"
const { ExtensionStateContextProvider } = ExtensionStateContext

import WelcomeViewProvider from "../WelcomeViewProvider"
import { vscode } from "@src/utils/vscode"

// Mock Button component
vi.mock("@src/components/ui", () => ({
	Button: ({ children, onClick, variant }: any) => (
		<button onClick={onClick} data-testid={`button-${variant}`}>
			{children}
		</button>
	),
}))

// Mock ApiOptions
vi.mock("../../settings/ApiOptions", () => ({
	default: ({ errorMessage }: any) => (
		<div data-testid="api-options">{errorMessage ? `Error: ${errorMessage}` : "API Options Component"}</div>
	),
}))

// Mock Tab components
vi.mock("../../common/Tab", () => ({
	Tab: ({ children }: any) => <div data-testid="tab">{children}</div>,
	TabContent: ({ children }: any) => <div data-testid="tab-content">{children}</div>,
}))

// Mock RooHero
vi.mock("../RooHero", () => ({
	default: () => <div data-testid="roo-hero">Roo Hero</div>,
}))

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
	ArrowRight: () => <span data-testid="arrow-right-icon">→</span>,
}))

// Mock vscode utility
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock react-i18next
vi.mock("react-i18next", () => ({
	Trans: ({ i18nKey, children }: any) => <span data-testid={`trans-${i18nKey}`}>{children || i18nKey}</span>,
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
}))

// Mock the translation hook
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

const renderWelcomeViewProvider = (extensionState = {}) => {
	const useExtensionStateMock = vi.spyOn(ExtensionStateContext, "useExtensionState")
	useExtensionStateMock.mockReturnValue({
		apiConfiguration: {},
		currentApiConfigName: "default",
		setApiConfiguration: vi.fn(),
		uriScheme: "vscode",
		...extensionState,
	} as any)

	render(
		<ExtensionStateContextProvider>
			<WelcomeViewProvider />
		</ExtensionStateContextProvider>,
	)

	return useExtensionStateMock
}

describe("WelcomeViewProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the Ollama-only setup screen", () => {
		renderWelcomeViewProvider()

		expect(screen.getByTestId("roo-hero")).toBeInTheDocument()
		expect(screen.getByText(/welcome:landing.greeting/)).toBeInTheDocument()
		expect(screen.getByTestId("trans-welcome:landing.introduction")).toBeInTheDocument()
		expect(screen.getByTestId("trans-welcome:landing.accountMention")).toBeInTheDocument()
		expect(screen.getByTestId("api-options")).toBeInTheDocument()
		expect(screen.getByTestId("button-primary")).toBeInTheDocument()
	})

	it("shows an error and avoids saving when the Ollama config is incomplete", () => {
		renderWelcomeViewProvider({ apiConfiguration: { apiProvider: "ollama" } })

		const saveButton = screen.getByTestId("button-primary")
		fireEvent.click(saveButton)

		expect(vscode.postMessage).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "upsertApiConfiguration" }),
		)
		expect(screen.getByText(/settings:validation.modelId/)).toBeInTheDocument()
	})

	it("saves the Ollama configuration when valid", () => {
		const apiConfiguration = {
			ollamaBaseUrl: "http://localhost:11434",
			ollamaModelId: "llama3",
		}

		renderWelcomeViewProvider({ apiConfiguration })

		const saveButton = screen.getByTestId("button-primary")
		fireEvent.click(saveButton)

		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "upsertApiConfiguration",
			text: "default",
			apiConfiguration: {
				apiProvider: "ollama",
				...apiConfiguration,
			},
		})
	})
})
