interface PostoEfetivoInfo {
  escala?: string | null;
}

export const getEfetivoPlanejadoAjustado = (_posto: PostoEfetivoInfo): number => {
  return 1;
};

export const getCoberturaParaPosto = (colaboradoresAtivos: number) => {
  const efetivoNecessario = 1;
  const efetivoConsiderado = Math.min(colaboradoresAtivos, efetivoNecessario);

  return {
    efetivoNecessario,
    efetivoConsiderado,
    estaCoberto: colaboradoresAtivos >= efetivoNecessario,
  };
};
