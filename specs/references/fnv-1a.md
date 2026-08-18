# FNV-1a — referência para a versão do deck

Fecha o achado SCI-03 da Iteração 2: em V(2) o FNV-1a entrou como mecanismo de versão do deck
**sem fonte citada**, violando a regra do projeto — nenhum algoritmo sem referência verificável.

## Fontes

- **Eastlake, D. et al.** *The FNV Non-Cryptographic Hash Algorithm*, Internet-Draft.
  <https://www.ietf.org/archive/id/draft-eastlake-fnv-21.html> ·
  <https://datatracker.ietf.org/doc/draft-eastlake-fnv/> (verificado 2026-08-18).
- **Fowler, G., Noll, L. C., Vo, K.-P.** Página canônica do algoritmo:
  <http://www.isthe.com/chongo/tech/comp/fnv/>.
- Resumo e constantes: <https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function>.

Origem: ideia enviada como comentário de revisor ao comitê IEEE POSIX P1003.2 por Glenn Fowler
e Phong Vo em 1991, com melhoria de Landon Curt Noll em rodada de votação subsequente.

## Algoritmo, como publicado

```
hash = offset_basis
para cada octeto de entrada:
    hash = hash XOR octeto        <-- FNV-1a: XOR ANTES da multiplicação
    hash = hash * FNV_prime
devolve hash
```

A ordem distingue as variantes: **FNV-1a faz XOR antes de multiplicar**; FNV-1 multiplica antes.
Trocar a ordem produz outro valor — é uma das formas silenciosas de o hash divergir entre duas
implementações do mesmo contrato.

Constantes de 32 bits, como publicadas:

| Constante | Valor |
|---|---|
| `FNV_prime` (32 bits) | 2²⁴ + 2⁸ + 0x93 = **16 777 619** |
| `offset_basis` (32 bits) | **2 166 136 261** |

## Por que serve aqui, e o que ele não é

O identificador de versão do deck precisa ser **determinístico, síncrono e barato** — não
precisa ser resistente a adversário. O deck é entrada confiável (§2: a aplicação não cria nem
edita conteúdo) e a versão só serve para **detectar troca**, não para autenticar. FNV-1a é
explicitamente **não criptográfico**: não usar para nada que dependa de resistência a colisão
deliberada.

Consequência da escolha, já registrada: colisão acidental entre duas versões de deck com
conteúdo diferente faria a migração não disparar. Com 32 bits e um punhado de versões ao longo
da vida do projeto, a probabilidade é desprezível; se algum dia o número de versões crescer,
a saída é ampliar para 64 bits — as constantes estão nas mesmas fontes.

## Entrada canônica

O hash é calculado sobre a forma canônica do deck — cada cartão como `id|hanzi|pinyin|gloss`,
na ordem em que aparecem no arquivo, unidos por `\n` — e **não** sobre os bytes do arquivo.
É isso que torna a versão insensível a indentação e a espaçamento (fecha MIG-03 e MEC-03).
