using opnetcli.Exceptions;
using opnetcli.Helpers;

namespace opnetcli.Commands.CreateContract;

public class CreateContract : BaseCommand
{
    public override string Name
    {
        get
        {
            return "CreateContract";
        }
    }

    private string _contractPath = string.Empty;
    private string _contractName = string.Empty;

    public CreateContract(IOPNETConsole console)
        :base(console)
    {
        
    }

    public override void Execute(ParsedResults parsedResult)
    {
        _console.WriteLine("OPNETCLI: CreateContract command detected.");

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
        _console.WriteLine($"\t1- Navigate to the '{_contractPath.Replace("\\", "/")}{_contractName}' folder.");
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
            else if (string.IsNullOrEmpty(contractName))
            {
                validations.Add(new CommandValidationResult()
                {
                    Message = "contractname parameter cannot be empty.",
                    ValidationResultType = CommandValidationResult.ValidationResultTypes.Error
                });
            }
        }

        foreach (var kvp in parsedResult.Parameters)
        {
            if (kvp.Key.ToLower() != "contractname" &&
                kvp.Key.ToLower() != "contractpath")
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
        _console.WriteLine("OPNETCLI: Creating the contract folders.");

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
        _console.WriteLine("OPNETCLI: Creating the contract source files.");

        string executingAssemblyDirectory = Path.GetDirectoryName(System.AppContext.BaseDirectory);

        executingAssemblyDirectory = executingAssemblyDirectory.Replace("\\", "/");

        if (!executingAssemblyDirectory.EndsWith("/"))
        {
            executingAssemblyDirectory += "/";
        }

        Dictionary<string, string> replaceTagValue = new();

        replaceTagValue.Add("<%CONTRACT_NAME%>", 
            _contractName);

        CopyContractFiles(executingAssemblyDirectory,
            replaceTagValue);
        CopyDeployFiles(executingAssemblyDirectory,
            replaceTagValue);
        CopyUnitTestFiles(executingAssemblyDirectory,
            replaceTagValue);

        _console.WriteLine($"OPNETCLI: Contract files created in '{_contractPath.Replace("\\", "/")}{_contractName}'");
    }

    private void CopyUnitTestFiles(string executingAssemblyDirectory,
        Dictionary<string, string> replaceTagValue)
    {
        _console.WriteLine("OPNETCLI: Creating the contract unit test files.");

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
        _console.WriteLine("OPNETCLI: Creating the contract deployment files.");

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

        CopyModified($"{executingAssemblyDirectory}templates/deploy/src/deploy.ts",
            $"{_contractPath}{_contractName}/deploy/src/deploy.ts",
            replaceTagValue);

        CopyModified($"{executingAssemblyDirectory}templates/deploy/package.json",
            $"{_contractPath}{_contractName}/deploy/package.json",
            replaceTagValue);
    }

    private void CopyContractFiles(string executingAssemblyDirectory,
        Dictionary<string, string> replaceTagValue)
    {
        System.IO.File.Copy($"{executingAssemblyDirectory}templates/contracts/.prettierrc.json",
                    $"{_contractPath}{_contractName}/.prettierrc.json",
                    true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/contracts/tsconfig.json",
            $"{_contractPath}{_contractName}/tsconfig.json",
            true);

        System.IO.File.Copy($"{executingAssemblyDirectory}templates/contracts/src/tsconfig.json",
            $"{_contractPath}{_contractName}/src/tsconfig.json",
            true);

        CopyModified($"{executingAssemblyDirectory}templates/contracts/asconfig.json",
            $"{_contractPath}{_contractName}/asconfig.json",
            replaceTagValue);

        CopyModified($"{executingAssemblyDirectory}templates/contracts/package.json",
            $"{_contractPath}{_contractName}/package.json",
            replaceTagValue);

        CopyModified($"{executingAssemblyDirectory}templates/contracts/src/index.ts",
            $"{_contractPath}{_contractName}/src/index.ts",
            replaceTagValue);

        CopyModified($"{executingAssemblyDirectory}templates/contracts/src/contracts/generic.ts",
            $"{_contractPath}{_contractName}/src/contracts/{_contractName}.ts",
            replaceTagValue);
    }

    private void CopyModified(string sourcePath,
        string destinationPath,
        Dictionary<string, string> replaceTagValue)
    { 
        var content = System.IO.File.ReadAllText(sourcePath);

        foreach (var kvp in replaceTagValue)
        {
            if (content.Contains(kvp.Key))
            {
                content = content.Replace(kvp.Key, kvp.Value);
            }
        }
        
        System.IO.File.WriteAllText(destinationPath, content);
    }
}
