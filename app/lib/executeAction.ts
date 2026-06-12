import { isRedirectError } from "next/dist/client/components/redirect-error";

type ExecuteActionOptions = {
  actionFn: () => Promise<void>;
  successMessage?: string;
};

type ExecuteActionResult = {
  success: boolean;
  message: string;
};

const executeAction = async ({
  actionFn,
  successMessage = "Action completed successfully",
}: ExecuteActionOptions): Promise<ExecuteActionResult> => {
  try {
    await actionFn();

    return {
      success: true,
      message: successMessage,
    };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      };
    }

    return {
      success: false,
      message: "An unexpected error occurred",
    };
  }
};

export { executeAction };
