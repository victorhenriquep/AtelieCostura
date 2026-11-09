# Slice de referência: Clientes

Cada arquivo desta pasta é **uma operação completa** (vertical slice):
endpoint + dados de entrada + handler, tudo junto. Para entender uma operação,
basta abrir um arquivo.

| Arquivo                   | Tipo     | Rota                              | Quem acessa   |
|---------------------------|----------|-----------------------------------|---------------|
| `ListarClientes.cs`       | Consulta | GET    /api/clientes              | Todos os perfis |
| `ObterCliente.cs`         | Consulta | GET    /api/clientes/{id}         | Todos os perfis |
| `ListarOpcoesClientes.cs` | Consulta | GET    /api/clientes/opcoes       | Administrador (para montar pedidos) |
| `CriarCliente.cs`         | Comando  | POST   /api/clientes              | Administrador |
| `AtualizarCliente.cs`     | Comando  | PUT    /api/clientes/{id}         | Administrador |
| `AlterarStatusCliente.cs` | Comando  | PATCH  /api/clientes/{id}/status  | Administrador |

Arquivos de apoio:
- `ClienteModelos.cs`: DTO de saída e dados de entrada, compartilhados pelas operações.
- `ClienteRegras.cs`: validações usadas por Criar e Atualizar.
- `ClientesEndpoints.cs`: junta as rotas sob `/api/clientes` (chamado no Program.cs).

## CQRS "leve"
- **Comando** altera dados: carrega a entidade *com* rastreamento, altera, chama `SaveChangesAsync`.
  O log de alterações é gravado automaticamente pelo `AppDbContext`.
- **Consulta** só lê: usa `AsNoTracking()` e projeta direto para o DTO.

Não usamos MediatR: o endpoint recebe o `Handler` por injeção de dependência e chama `Handle`.

## Para criar uma operação nova
1. Crie um arquivo `NomeDaOperacao.cs` com uma classe estática contendo `Mapear` e `Handler`.
2. O `Handler` implementa `IHandler` (registro automático na DI).
3. Chame `NomeDaOperacao.Mapear(grupo)` em `ClientesEndpoints.cs`.
