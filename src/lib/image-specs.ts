// Orientação de tamanho das imagens de capa (login e painel). Usado no navegador e no servidor.

/** Orientação de tamanho de cada imagem (mostrada na tela de envio). */
export const IMAGE_SPECS = {
  login: {
    label: "Imagem da tela de login",
    ideal: { w: 1920, h: 1280 },
    min: { w: 1600, h: 900 },
    ratio: "3:2",
    focus:
      "No computador a foto ocupa a metade esquerda da tela, com o texto à esquerda; no celular vira a faixa do topo, com o texto embaixo. Deixe o principal (motos, estrada) no centro ou à direita.",
  },
  panel: {
    label: "Imagem do painel",
    ideal: { w: 1920, h: 1080 },
    min: { w: 1600, h: 900 },
    ratio: "16:9",
    focus:
      "A foto é a capa da visão geral. À esquerda e embaixo ficam a saudação, o comboio e os botões; à direita, a contagem regressiva. Deixe o principal à direita e evite texto escrito na foto.",
  },
} as const;
export type ImageKind = keyof typeof IMAGE_SPECS;
