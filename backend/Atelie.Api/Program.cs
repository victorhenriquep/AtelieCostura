using System.Text.Json.Serialization;
using Atelie.Api.Features.Auth;
using Atelie.Api.Features.Clientes;
using Atelie.Api.Features.Financeiro;
using Atelie.Api.Features.Indicadores;
using Atelie.Api.Features.Funcionarios;
using Atelie.Api.Features.Logs;
using Atelie.Api.Features.Pedidos;
using Atelie.Api.Features.Servicos;
using Atelie.Api.Infrastructure.Auth;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ---------------------------------------------------------------
// Banco de dados (SQLite: arquivo atelie.db na pasta do projeto)
// ---------------------------------------------------------------
builder.Services.AddDbContext<AppDbContext>(opcoes =>
    opcoes.UseSqlite(config.GetConnectionString("Atelie") ?? "Data Source=atelie.db"));

// ---------------------------------------------------------------
// Serviços da aplicação
// ---------------------------------------------------------------
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<UsuarioAtual>();
builder.Services.AddSingleton<IPasswordHasher<Funcionario>, PasswordHasher<Funcionario>>();

var producao = config.GetSection("Producao").Get<ConfiguracaoProducao>() ?? new ConfiguracaoProducao();
builder.Services.AddSingleton(producao);
builder.Services.AddSingleton<CalculadoraDataEntrega>();
builder.Services.AddScoped<AgendaProducao>();

builder.Services.AddHandlers(); // registra todas as classes que implementam IHandler

// Enums no JSON como texto ("Administrador", "EmProducao") em vez de número
builder.Services.ConfigureHttpJsonOptions(opcoes =>
    opcoes.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// ---------------------------------------------------------------
// Autenticação (JWT) e autorização (perfis)
// ---------------------------------------------------------------
var jwt = config.GetSection("Jwt").Get<ConfiguracaoJwt>()
    ?? throw new InvalidOperationException("Configure a seção \"Jwt\" no appsettings.json.");
if (jwt.Chave.Length < 32)
    throw new InvalidOperationException("A chave do JWT (Jwt:Chave) precisa ter pelo menos 32 caracteres.");

builder.Services.AddSingleton(jwt);
builder.Services.AddSingleton<TokenService>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opcoes =>
    {
        opcoes.MapInboundClaims = false; // mantém os nomes curtos: "sub", "name", "role"
        opcoes.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Emissor,
            ValidateAudience = true,
            ValidAudience = jwt.Audiencia,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = jwt.ChaveDeAssinatura(),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            NameClaimType = ClaimsDoToken.Nome,
            RoleClaimType = ClaimsDoToken.Perfil,
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Politicas.SomenteAdministrador, p => p.RequireRole(nameof(Perfil.Administrador)))
    .AddPolicy(Politicas.TodosOsPerfis, p => p.RequireRole(nameof(Perfil.Administrador), nameof(Perfil.Visualizador)));

// ---------------------------------------------------------------
// CORS: libera o front (Vite em http://localhost:5173) para chamar a API
// ---------------------------------------------------------------
var origens = config.GetSection("Cors:Origens").Get<string[]>() ?? new[] { "http://localhost:5173" };
builder.Services.AddCors(opcoes =>
    opcoes.AddPolicy("Front", p => p.WithOrigins(origens).AllowAnyHeader().AllowAnyMethod()));

// ===============================================================
var app = builder.Build();

app.UseCors("Front");
app.UseMiddleware<TratamentoErrosMiddleware>();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => "API do Ateliê rodando. Veja o arquivo Atelie.http para testar as rotas.");
app.MapAuth();
app.MapClientes();
app.MapServicos();
app.MapFuncionarios();
app.MapPedidos();
app.MapRecebimentos();
app.MapPagamentos();
app.MapFluxoCaixa();
app.MapIndicadores();
app.MapLogs();

await DbSeeder.InicializarAsync(app.Services); // cria o banco e os usuários iniciais

app.Run();

// Permite que projetos de teste referenciem a classe Program
public partial class Program { }
