import { create } from "zustand"
import type {
  InspecaoStep1,
  InspecaoStep2,
  InspecaoStep3,
  InspecaoStep4,
  InspecaoStep5,
  InspecaoStep6,
} from "@/types/app"

interface InspecaoState {
  // ID gerado após salvar o step 1 no banco
  inspecaoId: string | null

  // Dados de cada step
  step1: InspecaoStep1 | null
  step2: InspecaoStep2 | null
  step3: InspecaoStep3 | null
  step4: InspecaoStep4 | null
  step5: InspecaoStep5 | null
  step6: InspecaoStep6 | null

  // Ações
  setInspecaoId: (id: string) => void
  setDados:      (dados: InspecaoStep1) => void
  setAvaliacao:  (avaliacao: InspecaoStep2) => void
  setSeguranca:  (seguranca: InspecaoStep3) => void
  setEpis:       (epis: InspecaoStep4) => void
  setNCs:        (ncs: InspecaoStep5) => void
  setReconhecimento: (rec: InspecaoStep6) => void
  resetInspecao: () => void
}

const initialState = {
  inspecaoId: null,
  step1: null,
  step2: null,
  step3: null,
  step4: null,
  step5: null,
  step6: null,
}

export const useInspecaoStore = create<InspecaoState>((set) => ({
  ...initialState,

  setInspecaoId: (id) => set({ inspecaoId: id }),
  setDados:      (step1) => set({ step1 }),
  setAvaliacao:  (step2) => set({ step2 }),
  setSeguranca:  (step3) => set({ step3 }),
  setEpis:       (step4) => set({ step4 }),
  setNCs:        (step5) => set({ step5 }),
  setReconhecimento: (step6) => set({ step6 }),

  resetInspecao: () => set(initialState),
}))
