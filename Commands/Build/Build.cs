using opnetcli.Exceptions;
using opnetcli.Helpers;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace opnetcli.Commands.Build;

// Undocumented for now. Experimental...
public class Build : BaseCommand
{
    public override string Name
    {
        get
        {
            return "Build";
        }
    }

    public Build(IOPNETConsole console)
        : base(console)
    {

    }
     
    public override void Execute(ParsedResults parsedResult)
    {
        _console.WriteLine("OPNETCLI: Build command detected.");
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

        bool isWindows = RuntimeInformation.IsOSPlatform(OSPlatform.Windows);
        bool isMacOS = RuntimeInformation.IsOSPlatform(OSPlatform.OSX);
        bool isLinux = RuntimeInformation.IsOSPlatform(OSPlatform.Linux);

        string shell;
        string shellArgs;

        if (isWindows)
        {
            shell = "cmd.exe";
            shellArgs = "/c npm run build";
        }
        else if (isMacOS || isLinux)
        {
            shell = "/bin/bash";
            shellArgs = "-c \"npm run build\"";
        }
        else
        {
            throw new CommandExecutionException("Unsupported operating system.");
        }

        ProcessStartInfo processStartInfo = new ProcessStartInfo
        {
            FileName = shell,
            Arguments = shellArgs,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardErrorEncoding = System.Text.Encoding.UTF8,
            StandardOutputEncoding = System.Text.Encoding.UTF8,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        Process process = new Process
        {
            StartInfo = processStartInfo
        };

        try
        {
            process.Start();

            process.WaitForExit();

            string output = process.StandardOutput.ReadToEnd();
            string error = process.StandardError.ReadToEnd();

            if (!string.IsNullOrWhiteSpace(output))
            {
                var encoding = _console.OutputEncoding;
                _console.OutputEncoding = System.Text.Encoding.UTF8;
                _console.WriteLine(output);
                _console.OutputEncoding = encoding;
            }

            if (!string.IsNullOrWhiteSpace(error))
            {
                var encoding = _console.OutputEncoding;
                _console.OutputEncoding = System.Text.Encoding.UTF8;
                _console.WriteLine(error);
                _console.OutputEncoding = encoding;
            }
        }
        catch (Exception ex)
        {
            throw new CommandExecutionException($"An error occurred while running the npm command: {ex.Message}");
        }

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
