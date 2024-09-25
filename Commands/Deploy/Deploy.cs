using opnetcli.Exceptions;
using opnetcli.Helpers;

namespace opnetcli.Commands.Deploy;

public class Deploy : BaseCommand
{
    public override string Name
    {
        get
        {
            return "Deploy";
        }
    }

    private string _contractName = string.Empty;

    public Deploy(IOPNETConsole console)
        : base(console)
    {

    }

    public override void Execute(ParsedResults parsedResult)
    {
        _console.WriteLine("OPNETCLI: Deploy command detected.");

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
        
        _console.ForegroundColor = ConsoleColor.Blue;
        _console.WriteLine($"OPNETCLI: To deploy a contract:");
        _console.WriteLine($"\t1- Navigate to the 'deploy' folder.");
        _console.WriteLine($"\t2- Using a text editor, open the 'config.ts' file.");
        _console.WriteLine($"\t3- Set the 'OPNET_PROVIDER' and 'network' values to the desired provider and network.");
        _console.WriteLine($"\t4- Replace 'YOUR PRIVATE KEY HERE' with your wallet's private key.");
        _console.WriteLine($"\t5- In the deployContract.ts file, adjust the minAmount, requestedAmount, feeRate and priorityFee to your needs.");
        _console.WriteLine($"\t6- Save your changes.");
        _console.WriteLine($"");
        _console.WriteLine($"Run the following commands:");
        _console.WriteLine($"\tnpm i");
        _console.WriteLine($"then");
        _console.WriteLine($"\tgulp");
        _console.WriteLine($"");
        _console.WriteLine($"\t6- Navigate to the contract main folder.");
        _console.WriteLine($"");
        _console.WriteLine($"Run the following command:");
        _console.WriteLine($"\tnode ./deploy/build/deploy.js");
        _console.ForegroundColor = ConsoleColor.Red;
        _console.WriteLine($"\t- Warning:");
        _console.WriteLine($"\t-Do not leave your wallet private key exposed in the the 'config.ts' file.");
        _console.WriteLine($"\t Once you have deployed the contract, remove it from this file.");
        _console.WriteLine($"\t-Do not push the 'config.ts' to any repository without removing the wallet private key.");
        _console.ResetColor();
    }

    protected override List<CommandValidationResult> ValidateCommandLine(ParsedResults parsedResult)
    {
        List<CommandValidationResult> validations = new List<CommandValidationResult>();

        foreach (var kvp in parsedResult.Parameters)
        {
            validations.Add(new CommandValidationResult()
            {
                Message = $"{kvp.Key} was ignored as it is not a valid command parameter.",
                ValidationResultType = CommandValidationResult.ValidationResultTypes.Warning
            });
        }

        return validations;
    }
}