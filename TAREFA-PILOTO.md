# Brief — aplicação web progressiva para estudo de chinês

Documento de requisitos. **Congelado**: nenhuma alteração após o início da construção.

---

## 1. Objetivo

Construir uma PWA que apresente cartões de vocabulário chinês em revisão espaçada,
funcione sem rede e sincronize progresso entre dispositivos.

## 2. Restrições técnicas

- **TypeScript**, executando no navegador.
- Nenhum framework é obrigatório; a escolha é livre.
- **Módulos são diretórios de primeiro nível sob `src/`.** Cada módulo expõe sua
  interface por um ponto de entrada explícito.
- O conteúdo entra como *deck* JSON fixo, fornecido como entrada (formato na §5).
  A aplicação não cria nem edita conteúdo.

## 3. Fora de escopo

Não construir, e não incluir nos critérios de aceitação:

- reprodução de áudio
- renderização de ordem de traços
- autoria ou edição de lições
- autenticação de usuário

## 4. Algoritmo de agendamento — fixo

**SM-2.** Cada cartão guarda número de repetições `n`, fator de facilidade `EF`
(inicial 2,5) e intervalo `I` em dias. A nota `q` vai de 0 a 5.

```
se q >= 3:
    se n == 0:  I = 1
    se n == 1:  I = 6
    senão:      I = round(I_anterior * EF)
    n = n + 1
senão:
    n = 0
    I = 1

EF = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
EF = max(EF, 1.3)
```

Não substituir por outro algoritmo nem por variante "simplificada".

## 5. Formato do *deck*

```json
[
  { "id": "c001", "hanzi": "你好", "pinyin": "nǐ hǎo", "gloss": "hello" }
]
```

## 6. Entrega em três incrementos

Cada incremento é entregue e aceito antes do seguinte começar.

### Incremento 1 — núcleo de revisão

Laço de revisão espaçada sobre o *deck* fixo. Sem persistência além da sessão em
memória, sem rede.

**Aceitação**
- dado o *deck*, o agendador apresenta apenas os cartões devidos
- a nota `q` é registrada e o próximo intervalo é recomputado conforme a §4
- uma sessão de revisão pode ser concluída do início ao fim

### Incremento 2 — offline e persistência

A aplicação funciona com a rede desligada e sobrevive a recarga da página.

**Aceitação**
- *service worker* registrado, com estratégia de cache declarada por escrito
- partida a frio **offline** funciona
- *deck* e progresso persistem localmente e sobrevivem a recarga
- o modelo de conteúdo é versionado, e uma troca de versão do *deck* migra o progresso
  sem perda

### Incremento 3 — sincronização com conflito

O progresso sincroniza com um armazenamento remoto e reconcilia dois dispositivos que
revisaram os mesmos cartões enquanto offline. O remoto pode ser um endpoint JSON simples
ou um duplo local — o que importa é a reconciliação.

**Aceitação**
- dados dois estados locais divergentes sobre os mesmos cartões, a sincronização produz
  uma resolução **definida e documentada**
- nenhum dos dois lados perde revisões já registradas
- o comportamento sob conflito é reproduzível a partir de um cenário descrito

## 7. Higiene de versionamento

Comitar a cada passo com significado próprio. **Não agrupar um incremento inteiro num
único *commit***, e não comitar apenas ao final.
