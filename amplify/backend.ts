import { defineBackend } from "@aws-amplify/backend";
import { Stack } from "aws-cdk-lib";
import {
  Function as LambdaFunction,
  FunctionUrlAuthType,
} from "aws-cdk-lib/aws-lambda";
import { data } from "./data/resource";
import { wayfindApiFunction } from "./functions/wayfind-api/resource";

const backend = defineBackend({
  data,
  wayfindApiFunction,
});

const apiLambda = backend.wayfindApiFunction.resources.lambda as LambdaFunction;

const apiFunctionUrl = apiLambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

backend.addOutput({
  custom: {
    wayfindApi: {
      functionUrl: apiFunctionUrl.url,
      region: Stack.of(apiLambda).region,
      functionName: apiLambda.functionName,
    },
  },
});
