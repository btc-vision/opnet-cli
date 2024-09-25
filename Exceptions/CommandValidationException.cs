using opnetcli.Commands;

namespace opnetcli.Exceptions;

public class CommandValidationException : ApplicationException
{
    public List<CommandValidationResult> ValidationResults { get; } = new ();

    public bool HasErrors
    {
        get 
        { 
            return ValidationResults.Any(x=>x.ValidationResultType == CommandValidationResult.ValidationResultTypes.Error); 
        }
    }

    public CommandValidationException(List<CommandValidationResult> commandValidationResults)
    {
        ValidationResults.AddRange(commandValidationResults);
    }
}
