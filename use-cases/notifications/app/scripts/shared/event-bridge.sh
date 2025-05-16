#!/bin/bash

register_event_bridge() {
  ####  EventBridge  #####
  # Convert to list
  eventbridge_required_types=($(jq -r '.EventBridge[]' "$notification_type_def_file"))

  # Check if any of the notification types require EventBridge
  needs_eventbridge=false
  for required in "${eventbridge_required_types[@]}"; do
    if echo "$notification_types" | grep -q "$required"; then
      needs_eventbridge=true
      break
    fi
  done

  if $needs_eventbridge; then
    echo "🔔 One or more NotificationTypes in app-config require EventBridge." >&2
    echo "🔍 Checking for existing EventBridge destination..." >&2
    client_id=$(jq -r '.GrantlessOperationConfig.ClientId' "$config_file")
    client_secret=$(jq -r '.GrantlessOperationConfig.ClientSecret' "$config_file")
    grantless_scope="sellingpartnerapi::notifications"
    api_region_code=$(jq -r '.GrantlessOperationConfig.RegionCode' "$config_file")

    token_response=$(curl -s -X POST "https://api.amazon.com/auth/o2/token" \
      -H "Content-Type: application/x-www-form-urlencoded;charset=UTF-8" \
      -d "grant_type=client_credentials&scope=${grantless_scope}&client_id=${client_id}&client_secret=${client_secret}")

    grantless_token=$(echo "$token_response" | jq -r '.access_token')

    if [ -z "$grantless_token" ] || [ "$grantless_token" == "null" ]; then
      echo "❌ Failed to retrieve grantless access token" >&2
      echo "$token_response" >&2
      return 1
    fi

    if [ "$api_region_code" == "FE" ]; then
      endpoint="https://sellingpartnerapi-fe.amazon.com"
    elif [ "$api_region_code" == "NA" ]; then
      endpoint="https://sellingpartnerapi-na.amazon.com"
    elif [ "$api_region_code" == "EU" ]; then
      endpoint="https://sellingpartnerapi-eu.amazon.com"
    else
      echo "❌ Unknown region code: $api_region_code" >&2
      return 1
    fi

    mkdir -p tmp

    # Step 1: Check existing EventBridge destination
    echo "🔍 Checking for existing EventBridge destination..." >&2
    destination_json=$(curl -s -X GET "$endpoint/notifications/v1/destinations" \
      -H "x-amz-access-token: ${grantless_token}")

    existing_destination=$(echo "$destination_json" | jq -c \
      --arg accountId "$aws_account_id" \
      --arg region "$aws_region" \
      '.payload[] | select(.resource.eventBridge != null and .resource.eventBridge.accountId == $accountId and .resource.eventBridge.region == $region)')

    if [ -n "$existing_destination" ]; then
      echo "✅ Found existing EventBridge destination" >&2
      destination_id=$(echo "$existing_destination" | jq -r '.destinationId')
      event_bridge_name=$(echo "$existing_destination" | jq -r '.resource.eventBridge.name')
    else
      echo "🚀 Creating new EventBridge destination..." >&2
      create_response=$(curl -s -X POST "$endpoint/notifications/v1/destinations" \
        -H "x-amz-access-token: ${grantless_token}" \
        -H "Content-Type: application/json" \
        -d '{
          "resourceSpecification": {
            "eventBridge": {
              "accountId": "'"${aws_account_id}"'",
              "region": "'"${aws_region}"'"
            }
          },
          "name": "spapi-eventbridge-destination-'$(date +%s)'"
        }')

      destination_id=$(echo "$create_response" | jq -r '.payload.destinationId')
      event_bridge_name=$(echo "$create_response" | jq -r '.payload.resource.eventBridge.name')

      if [ -z "$destination_id" ] || [ "$destination_id" == "null" ]; then
        echo "❌ Failed to create EventBridge destination" >&2
        echo "$create_response" >&2
        return 1
      fi

      echo "✅ Created new destination: $destination_id" >&2
    fi

    # Step 2: Derive Event Source name & Bus ARN
    event_source_name="$event_bridge_name"
    event_bus_name="$event_bridge_name"
    event_bus_arn="arn:aws:events:${aws_region}:${aws_account_id}:event-bus/${event_bridge_name}"

    # Output for CDK
    echo "$destination_id" > tmp/destination_id.txt
    echo "$event_bus_arn" > tmp/event_bus_arn.txt

    echo "📌 DestinationId: $destination_id" >&2
    echo "📌 EventSourceName: $event_source_name" >&2
    echo "📌 EventBusName: $event_bus_name" >&2
    echo "📌 EventBusArn: $event_bus_arn" >&2

    echo "🔍 Checking if Event Bus has been associated..." >&2

    describe_output=$(aws events describe-event-bus \
      --name "$event_source_name" \
      --region "$aws_region" 2>&1)

    if echo "$describe_output" | grep -q "$event_bus_arn"; then
      echo "✅ Partner Event Source is associated and EventBus is active." >&2
    else
      echo "⚠️ EventBus is not found or not yet associated." >&2
      echo "📣 Please go to the AWS Console -> Amazon EventBridge -> Integration -> Partner event sources and manually associate the Partner Event Source:" >&2
      echo "https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide#step-2-configure-amazon-eventbridge-to-handle-notifications" >&2
      echo "   👉 Event Source Name: $event_source_name" >&2
      echo "   👉 Then retry this script after association is completed." >&2
      return 1
    fi
  fi

  echo "$destination_id|$event_bus_arn"
  return 0
####  EventBridge  #####
}