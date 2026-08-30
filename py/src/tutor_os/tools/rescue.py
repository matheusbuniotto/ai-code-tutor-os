"""Port of src/mastra/tools/rescue.ts.

Cognitive Rescue Engine: diagnoses real-time blockages against the 2E
profile and prescribes exactly ONE concrete micro-intervention.
"""

from __future__ import annotations

from typing import Literal

Scenario = Literal[
    "travou_no_meio",
    "nao_sabe_comecar",
    "analise_infinita",
    "funciona_mas_podia_melhorar",
    "nao_to_entendendo_nada",
    "tom_seco_iceberg",
    "sindrome_impostor_comparacao",
    "arquitetura_perfeita_sem_rodar",
]

_SCENARIOS: dict[Scenario, dict[str, str]] = {
    "travou_no_meio": {
        "realMechanism": "Controle inibitório abaixo da média não consegue fechar loops concorrentes na memória de trabalho. Não é falta de dopamina.",
        "prescribedAction": "Peça um RAM Dump de 2 minutos sobre o que mais está ocupando a cabeça no momento. Em seguida, defina um critério binário de 'pronto quando'.",
        "cbtHook": "Postponing (MCT): 'Reserva isso para depois. Agora volta ao presente.'",
    },
    "nao_sabe_comecar": {
        "realMechanism": "Falta de clareza inicial OU medo de exposição/erro (traço evitativo elevado) OU loop aberto anterior.",
        "prescribedAction": "Pergunte qual dos 3. Clareza ➔ Ação física <2min (abrir arquivo e escrever título). Medo ➔ Declare 'Modo rascunho feio, julgamento suspenso por design'. Loop ➔ RAM dump rápido.",
        "cbtHook": "Defusão (ACT): 'Esse receio é um evento mental transitório, não uma previsão real de fracasso.'",
    },
    "analise_infinita": {
        "realMechanism": "Perfil cognitivo de raciocínio elevado enxerga mais permutações de arquitetura que a média; controle inibitório não filtra.",
        "prescribedAction": "Pergunte qual foi o PRIMEIRO instinto. Escolha no máximo 3 critérios de decisão, execute a mais simples e guarde as outras no backlog.",
        "cbtHook": "Experimento (CBT): 'Valida a opção mais simples primeiro para gerar evidência empírica antes de otimizar.'",
    },
    "funciona_mas_podia_melhorar": {
        "realMechanism": "Padrões implacáveis (esquema) OU medo de crítica externa.",
        "prescribedAction": "Pergunte: 'Teste está verde e comportamento externo mudou? Se não ➔ mover polimento para backlog e avançar.'",
        "cbtHook": "Defusão (CFT): 'Bom o suficiente é o que produz evidência e fecha o ciclo.'",
    },
    "nao_to_entendendo_nada": {
        "realMechanism": "Zona de Desenvolvimento Proximal (ZDP) alta demais OU autocrítica ('deveria entender rápido') OU bateria esgotada (fadiga elevada).",
        "prescribedAction": "ZDP ➔ Quebra menor + analogia de baixo nível. Autocrítica ➔ Defusão. Reserva baixa ➔ Encerrar sessão imediatamente com zero julgamento.",
        "cbtHook": "Self-compassion (CFT): 'O que você diria a um colega muito inteligente enfrentando essa complexidade pela primeira vez?'",
    },
    "tom_seco_iceberg": {
        "realMechanism": "O Iceberg: Sobrecarga emocional interna com exterior contido (vulnerabilidade elevada + baixa expressão externa).",
        "prescribedAction": "NUNCA pergunte 'você está bem?'. Reduza o ritmo, abra espaço sem cobrança e ofereça pausa explícita para retomar em outro momento.",
        "cbtHook": "Somatic interrupt: Banho, caminhada em silêncio ou NSDR.",
    },
    "sindrome_impostor_comparacao": {
        "realMechanism": "Distorção de Competência Percebida (autopercepção baixa vs realização real alta). Comparação com especialistas estreitos de 10 anos.",
        "prescribedAction": "Apresente 1 artefato concreto já entregue nos episódios passados. Não faça debates teóricos; aponte o dado objetivo.",
        "cbtHook": "Reframe Estratégico: 'Seu perfil híbrido (IA + Dados + Produto) é um super-poder assimétrico.'",
    },
    "arquitetura_perfeita_sem_rodar": {
        "realMechanism": "Loop de otimização prematura tentando eliminar incerteza no papel.",
        "prescribedAction": "Proponha o 'MVP Feio': 'Qual é o código mais feio e direto que roda agora e prova se a premissa funciona?'",
        "cbtHook": "Tracer bullet rule: 'O compilador/runtime é o único árbitro de verdade.'",
    },
}


def rescue_diagnose(scenario: Scenario, details: str | None = None) -> dict:
    """Diagnostica bloqueios cognitivos/operacionais usando a matriz 2E calibrada ao laudo.

    Retorna a causa neuropsicológica real e a ÚNICA ação imediata prescrita.

    Args:
        scenario: Cenário de bloqueio observado.
        details: Contexto ou frase dita pelo usuário.
    """
    data = _SCENARIOS[scenario]
    return {"scenario": scenario, **data}
