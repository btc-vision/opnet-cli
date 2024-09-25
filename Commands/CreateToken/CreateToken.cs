using opnetcli.Exceptions;
using opnetcli.Helpers;

namespace opnetcli.Commands.CreateToken;

public class CreateToken : BaseCommand
{
    public override string Name
    {
        get
        {
            return "CreateToken";
        }
    }

    private string _contractPath = string.Empty;
    private string _contractName = string.Empty;
    private string _tokenName = string.Empty;
    private string _tokenSymbol = string.Empty;
    private string _tokenDecimals = string.Empty;
    private string _tokenMaxSupply = string.Empty;

    public CreateToken(IOPNETConsole console)
        : base(console)
    {

    }

    public override void Execute(ParsedResults parsedResult)
    {
        _console.WriteLine("OPNETCLI: CreateToken command detected.");

        _console.WriteLine("OPNETCLI: Analyzing command parameters.");

        var validationResults = ValidateCommandLine(parsedResult);

        if (validationResults.Any(x => x.ValidationResultType == CommandValidationResult.ValidationResultTypes.Error))
        {
            throw new CommandValidationException(validationResults);
        }
        else
        {
            foreach (var validationResult in validationResults)
            {
                if (validationResult.ValidationResultType == CommandValidationResult.ValidationResultTypes.Warning)
                {
                    _console.ForegroundColor = ConsoleColor.Yellow;
                }

                _console.WriteLine($"OPNETCLI: {validationResult.FormattedMessage}");
                _console.ResetColor();
            }
        }

        _contractName = parsedResult.GetValue("ContractName");
        _contractPath = parsedResult.GetValue("ContractPath");
        _tokenName = parsedResult.GetValue("TokenName");
        _tokenSymbol = parsedResult.GetValue("TokenSymbol");
        _tokenDecimals = parsedResult.GetValue("TokenDecimals");
        _tokenMaxSupply = parsedResult.GetValue("TokenMaxSupply");

        if (string.IsNullOrEmpty(_contractPath))
        {
            _contractPath = Environment.CurrentDirectory;
        }

        _contractPath.Replace("\\", "/");

        if (!_contractPath.EndsWith("/"))
        {
            _contractPath += "/";
        }

        ValidateDestinationFolderExists();
        CreateFolders();
        CopyTemplates();

        _console.ForegroundColor = ConsoleColor.Blue;
        _console.WriteLine($"OPNETCLI: To compile your contract:");
        _console.WriteLine($"\t1- Navigate to the '{_contractPath.Replace("\\","/")}{_contractName}' folder.");
        _console.WriteLine($"\t2- Run the following commands:");
        _console.WriteLine("");
        _console.WriteLine("\tnpm i");
        _console.WriteLine("then");
        _console.WriteLine("\tnpm run build");
        _console.ResetColor();
    }

    protected override List<CommandValidationResult> ValidateCommandLine(ParsedResults parsedResult)
    {
        List<CommandValidationResult> validations = new List<CommandValidationResult>();

        if (!parsedResult.HasParameter("ContractName"))
        {
            validations.Add(new CommandValidationResult()
            {
                Message = "contractname parameter is required.",
                ValidationResultType = CommandValidationResult.ValidationResultTypes.Error
            });
        }
        else
        {
            string contractName = parsedResult.GetValue("ContractName");

            if (contractName.Contains(' '))
            {
                validations.Add(new CommandValidationResult()
                {
                    Message = "No blank is allowed in the ContractName parameter.",
                    ValidationResultType = CommandValidationResult.ValidationResultTypes.Error
                });
            }
            else if(string.IsNullOrEmpty(contractName))
            {
                validations.Add(new CommandValidationResult()
                {
                    Message = "contractname parameter cannot be empty.",
                    ValidationResultType = CommandValidationResult.ValidationResultTypes.Error
                });
            }
        }

        if (!parsedResult.HasParameter("TokenName"))
        {
            validations.Add(new CommandValidationResult()
            {
                Message = "tokenname parameter is required.",
                ValidationResultType = CommandValidationResult.ValidationResultTypes.Error
            });
        }
        else if(string.IsNullOrEmpty(parsedResult.GetValue("TokenName")))
        {
            validations.Add(new CommandValidationResult()
            {
                Message = "tokenname parameter cannot be empty.",
                ValidationResultType = CommandValidationResult.ValidationResultTypes.Error
            });
        }

        if (!parsedResult.HasParameter("TokenSymbol"))
        {
            validations.Add(new CommandValidationResult()
            {
                Message = "tokensymbol parameter is required.",
                ValidationResultType = CommandValidationResult.ValidationResultTypes.Error
            });
        }
        else if (string.IsNullOrEmpty(parsedResult.GetValue("TokenSymbol")))
        {
            validations.Add(new CommandValidationResult()
            {
                Message = "tokensymbol parameter cannot be empty.",
                ValidationResultType = CommandValidationResult.ValidationResultTypes.Error
            });
        }

        if (!parsedResult.HasParameter("TokenDecimals"))
        {
            validations.Add(new CommandValidationResult()
            {
                Message = "tokendecimals parameter is required.",
                ValidationResultType = CommandValidationResult.ValidationResultTypes.Error
            });
        }
        else if (string.IsNullOrEmpty(parsedResult.GetValue("TokenDecimals")))
        {
            validations.Add(new CommandValidationResult()
            {
                Message = "tokendecimals parameter cannot be empty.",
                ValidationResultType = CommandValidationResult.ValidationResultTypes.Error
            });
        }
        else
        {
            if(!int.TryParse(parsedResult.GetValue("TokenDecimals"), out var result))
            {
                validations.Add(new CommandValidationResult()
                {
                    Message = "tokendecimals parameter must be a integer value.",
                    ValidationResultType = CommandValidationResult.ValidationResultTypes.Error
                });
            }
        }

        if (!parsedResult.HasParameter("TokenMaxSupply"))
        {
            validations.Add(new CommandValidationResult()
            {
                Message = "tokenmaxsupply parameter is required.",
                ValidationResultType = CommandValidationResult.ValidationResultTypes.Error
            });
        }
        else if (string.IsNullOrEmpty(parsedResult.GetValue("TokenMaxSupply")))
        {
            validations.Add(new CommandValidationResult()
            {
                Message = "tokenmaxsupply parameter cannot be empty.",
                ValidationResultType = CommandValidationResult.ValidationResultTypes.Error
            });
        }
        else
        {
            if (!int.TryParse(parsedResult.GetValue("TokenMaxSupply"), out var result))
            {
                validations.Add(new CommandValidationResult()
                {
                    Message = "tokenmaxsupply parameter must be a integer value.",
                    ValidationResultType = CommandValidationResult.ValidationResultTypes.Error
                });
            }
        }

        foreach (var kvp in parsedResult.Parameters)
        {
            if (kvp.Key.ToLower() != "contractname" &&
                kvp.Key.ToLower() != "contractpath" &&
                kvp.Key.ToLower() != "tokenname" &&
                kvp.Key.ToLower() != "tokensymbol" &&
                kvp.Key.ToLower() != "tokendecimals" &&
                kvp.Key.ToLower() != "tokenmaxsupply")
            {
                validations.Add(new CommandValidationResult()
                {
                    Message = $"{kvp.Key} was ignored as it is not a valid command parameter.",
                    ValidationResultType = CommandValidationResult.ValidationResultTypes.Warning
                });
            }
        }

        return validations;
    }

    protected void ValidateDestinationFolderExists()
    {
        if (System.IO.Directory.Exists($"{_contractPath}{_contractName}"))
        {
            throw new CommandExecutionException($"The target destination already exists: '{_contractPath}{_contractName}'");
        }
    }

    private void CreateFolders()
    {
        _console.WriteLine("OPNETCLI: Creating the token contract folders.");

        Directory.CreateDirectory($"{_contractPath}{_contractName}");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/src");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/src/contracts");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/src/contracts/events");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/deploy");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/deploy/src");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/unittests");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/unittests/bytecode");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/unittests/src");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/unittests/src/blockchain");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/unittests/src/contracts");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/unittests/src/interfaces");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/unittests/src/opnet");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/unittests/src/opnet/modules");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/unittests/src/opnet/unit");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/unittests/src/opnet/vm");
        Directory.CreateDirectory($"{_contractPath}{_contractName}/unittests/src/tests");
    }

    private void CopyTemplates()
    {
        _console.WriteLine("OPNETCLI: Creating the token contract source files.");

        string executingAssemblyDirectory = Path.GetDirectoryName(System.AppContext.BaseDirectory);

        executingAssemblyDirectory = executingAssemblyDirectory.Replace("\\", "/");

        if (!executingAssemblyDirectory.EndsWith("/"))
        {
            executingAssemblyDirectory += "/";
        }

        Dictionary<string, string> replaceTagValue = new();

        replaceTagValue.Add("<%CONTRACT_NAME%>", _contractName);
        replaceTagValue.Add("<%TOKEN_SYMBOL%>", _tokenSymbol);
        replaceTagValue.Add("<%TOKEN_MAX_SUPPLY%>", _tokenMaxSupply);
        replaceTagValue.Add("<%TOKEN_DECIMALS%>", _tokenDecimals);
        replaceTagValue.Add("<%TOKEN_NAME%>", _tokenName);

        CopyTokenFiles(executingAssemblyDirectory,
            replaceTagValue);
        CopyDeployFiles(executingAssemblyDirectory,
            replaceTagValue);
        CopyUnitTestFiles(executingAssemblyDirectory,
            replaceTagValue);

        _console.WriteLine($"OPNETCLI: Contract files created in '{_contractPath.Replace("\\", "/")}{_contractName}'.");
    }

    private void CopyUnitTestFiles(string executingAssemblyDirectory,
        Dictionary<string, string> replaceTagValue)
    {
        _console.WriteLine("OPNETCLI: Creating the token unit test files.");

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/eslint.config.js",
            $"{_contractPath}{_contractName}/unittests/eslint.config.js",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/.prettierignore",
            $"{_contractPath}{_contractName}/unittests/.prettierignore",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/.prettierrc.json",
            $"{_contractPath}{_contractName}/unittests/.prettierrc.json",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/gulpfile.js",
            $"{_contractPath}{_contractName}/unittests/gulpfile.js",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/package.json",
            $"{_contractPath}{_contractName}/unittests/package.json",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/tsconfig.json",
            $"{_contractPath}{_contractName}/unittests/tsconfig.json",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/src/blockchain/Blockchain.ts",
            $"{_contractPath}{_contractName}/unittests/src/blockchain/Blockchain.ts",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/src/contracts/configs.ts",
            $"{_contractPath}{_contractName}/unittests/src/contracts/configs.ts",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/src/contracts/OP_20.ts",
            $"{_contractPath}{_contractName}/unittests/src/contracts/OP_20.ts",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/src/interfaces/RouterInterfaces.ts",
            $"{_contractPath}{_contractName}/unittests/src/interfaces/RouterInterfaces",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/src/opnet/modules/ContractRuntime.ts",
            $"{_contractPath}{_contractName}/unittests/src/opnet/modules/ContractRuntime.ts",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/src/opnet/modules/GetBytecode.ts",
            $"{_contractPath}{_contractName}/unittests/src/opnet/modules/GetBytecode.ts",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/src/opnet/unit/Assert.ts",
            $"{_contractPath}{_contractName}/unittests/src/opnet/unit/Assert.ts",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/src/opnet/unit/Assertion.ts",
            $"{_contractPath}{_contractName}/unittests/src/opnet/unit/Assertion.ts",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/src/opnet/unit/OPNetUnit.ts",
            $"{_contractPath}{_contractName}/unittests/src/opnet/unit/OPNetUnit.ts",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/src/opnet/vm/RustContract.ts",
            $"{_contractPath}{_contractName}/unittests/src/opnet/vm/RustContract.ts",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/src/opnet/vm/RustContractBinding.ts",
            $"{_contractPath}{_contractName}/unittests/src/opnet/vm/RustContractBinding.ts",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/bytecode/factory.wasm",
            $"{_contractPath}{_contractName}/unittests/bytecode/factory.wasm",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/bytecode/pool.wasm",
            $"{_contractPath}{_contractName}/unittests/bytecode/pool.wasm",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/bytecode/router.wasm",
            $"{_contractPath}{_contractName}/unittests/bytecode/router.wasm",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/unittests/bytecode/wbtc.wasm",
            $"{_contractPath}{_contractName}/unittests/bytecode/wbtc.wasm",
            true);

        CopyModified($"{executingAssemblyDirectory}templates/unittests/src/contracts/generic.ts",
            $"{_contractPath}{_contractName}/unittests/src/contracts/{_contractName}.ts",
            replaceTagValue);

        CopyModified($"{executingAssemblyDirectory}templates/unittests/src/tests/generic.ts",
            $"{_contractPath}{_contractName}/unittests/src/tests/{_contractName}.ts",
            replaceTagValue);
    }

    private void CopyDeployFiles(string executingAssemblyDirectory,
        Dictionary<string, string> replaceTagValue)
    {
        _console.WriteLine("OPNETCLI: Creating the token deployment files.");

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/deploy/src/config.ts",
            $"{_contractPath}{_contractName}/deploy/src/config.ts",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/deploy/src/deployContract.ts",
            $"{_contractPath}{_contractName}/deploy/src/deployContract.ts",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/deploy/.babelrc",
            $"{_contractPath}{_contractName}/deploy/.babelrc",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/deploy/.npmignore",
            $"{_contractPath}{_contractName}/deploy/.npmignore",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/deploy/.prettierrc.json",
            $"{_contractPath}{_contractName}/deploy/.prettierrc.json",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/deploy/gulpfile.js",
            $"{_contractPath}{_contractName}/deploy/gulpfile.js",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/deploy/tsconfig.base.json",
            $"{_contractPath}{_contractName}/deploy/tsconfig.base.json",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/deploy/tsconfig.json",
            $"{_contractPath}{_contractName}/deploy/tsconfig.json",
            true);

        CopyModified($"{executingAssemblyDirectory}templates/deploy/package.json",
            $"{_contractPath}{_contractName}/deploy/package.json",
            replaceTagValue);

        CopyModified($"{executingAssemblyDirectory}templates/deploy/src/deploy.ts",
            $"{_contractPath}{_contractName}/deploy/src/deploy.ts",
            replaceTagValue);
    }

    private void CopyTokenFiles(string executingAssemblyDirectory,
        Dictionary<string, string> replaceTagValue)
    {
        File.Copy($"{executingAssemblyDirectory}templates/tokens/.prettierrc.json",
                    $"{_contractPath}{_contractName}/.prettierrc.json",
                    true);

        File.Copy($"{executingAssemblyDirectory}templates/tokens/tsconfig.json",
            $"{_contractPath}{_contractName}/tsconfig.json",
            true);

        File.Copy($"{executingAssemblyDirectory}templates/tokens/src/tsconfig.json",
            $"{_contractPath}{_contractName}/src/tsconfig.json",
            true);

        CopyModified($"{executingAssemblyDirectory}templates/tokens/asconfig.json",
            $"{_contractPath}{_contractName}/asconfig.json",
            replaceTagValue);

        CopyModified($"{executingAssemblyDirectory}templates/tokens/package.json",
            $"{_contractPath}{_contractName}/package.json",
            replaceTagValue);

        CopyModified($"{executingAssemblyDirectory}templates/tokens/src/index.ts",
            $"{_contractPath}{_contractName}/src/index.ts",
            replaceTagValue);

        CopyModified($"{executingAssemblyDirectory}templates/tokens/src/contracts/generic.ts",
            $"{_contractPath}{_contractName}/src/contracts/{_contractName}.ts",
            replaceTagValue);
    }

    private void CopyModified(string sourcePath,
        string destinationPath,
        Dictionary<string, string> replaceTagValue)
    {
        var content = File.ReadAllText(sourcePath);

        foreach (var kvp in replaceTagValue)
        {
            if (content.Contains(kvp.Key))
            {
                content = content.Replace(kvp.Key, kvp.Value);
            }
        }

        File.WriteAllText(destinationPath, content);
    }
}
