using static opnetcli.Commands.CommandValidationResult;

namespace opnetcli.Commands;

public class CommandValidationResult
{
    public enum ValidationResultTypes
    {
        Info,
        Warning,
        Error
    }

    public string Message { get; set; }

    public string FormattedMessage
    {
        get
        {
            string resultType = string.Empty;

            switch(ValidationResultType)
            {
                case ValidationResultTypes.Info:
                    resultType = "Info";
                    break;
                case ValidationResultTypes.Warning:
                    resultType = "Warning";
                    break;
                case ValidationResultTypes.Error:
                    resultType = "Error";
                    break;
                default:
                    resultType = string.Empty;
                    break;
            }

            return $"{resultType}: {Message}";
        }
    }

    public ValidationResultTypes ValidationResultType { get; set; }
}
