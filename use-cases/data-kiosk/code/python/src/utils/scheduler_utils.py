import hashlib
import re
import json
import os
from datetime import datetime
from dependencies.graphql import parse, print_ast

from dataclasses import dataclass
from typing import Optional, List

import utils.constants as constants

# Scheduler Settings
flex_window = {"Mode": "FLEXIBLE", "MaximumWindowInMinutes": 1}
tag_value = [{'Key': 'environment', 'Value': 'development'}]


# Scheduler Dataclasses
@dataclass
class Document:
    documentId: Optional[str] = None
    documentUrl: Optional[str] = None
    s3Uri: Optional[str] = None


@dataclass
class Dataset:
    datasetName: Optional[int] = None
    newQuery: Optional[str] = None
    dateDifference: Optional[int] = None
    queryStartDate: Optional[str] = None
    queryEndDate: Optional[str] = None
    dataKeysStart: Optional[str] = None
    dataKeysEnd: Optional[str] = None
    dateFormat: Optional[str] = None
    dataReloadPeriod: Optional[int] = None
    fieldNames: Optional[List[str]] = None
    selectedFieldName: Optional[str] = None

    def __post_init__(self):
        if isinstance(self.fieldNames, dict) or isinstance(self.fieldNames, list):
            self.fieldNames = [str(fieldName) for fieldName in self.fieldNames]


@dataclass
class SchedulerLambdaInput:
    query: Optional[str] = None
    queryHash: Optional[str] = None
    scheduleName: Optional[str] = None
    scheduleStartDate: Optional[str] = None
    scheduleEndDate: Optional[str] = None
    minuteRate: Optional[int] = None
    accountId: Optional[str] = None
    dataset: Optional[Dataset] = None

    def __post_init__(self):
        if isinstance(self.dataset, dict):
            self.dataset = Dataset(**self.dataset)


# Scheduler Helper Functions
def setup_dataset_obj(query):
    dataset_obj = Dataset()
    dataset_obj.datasetName = extract_dataset_name(query)
    dataset_info = read_json_file(constants.QUERY_SCHEMA_DATASET_FILE_NAME).get(dataset_obj.datasetName, {})
    dataset_obj.dataKeysStart = dataset_info.get(constants.QUERY_SCHEMA_START_DATE, "")
    dataset_obj.newQuery = query
    dataset_obj.dataKeysEnd = dataset_info.get(constants.QUERY_SCHEMA_END_DATE, "")
    dataset_obj.dateFormat = dataset_info.get(constants.QUERY_SCHEMA_DATE_FORMAT, "")
    dataset_obj.fieldNames = dataset_info.get(constants.QUERY_SCHEMA_FIELD_NAMES, [])
    # TODO@chris get data reload period values from backend for different datasets
    dataset_obj.dataReloadPeriod = dataset_info.get(constants.QUERY_SCHEMA_DATA_RELOAD_PERIOD, 0)
    dataset_obj.selectedFieldName = next((field_name for field_name in dataset_obj.fieldNames if field_name in query),
                                         None)
    return dataset_obj


def create_hash(query_code, account_id):
    query_string = re.sub(r'\s+', '', query_code)
    query_with_account_id = f"{query_string}{account_id}"
    sorted_query = ''.join(sorted(query_with_account_id))
    query_hash = hashlib.md5(sorted_query.encode()).hexdigest()

    return query_hash


def extract_dataset_info(input_json, new_start_date=None, new_end_date=None):
    query = input_json[constants.NOTIFICATION_KEY_QUERY]
    dataset_obj = setup_dataset_obj(query)

    dataset_obj = extract_dates_from_graphql_query(dataset_obj=dataset_obj,
                                                   new_start_date=new_start_date,
                                                   new_end_date=new_end_date)

    query_end_date = datetime.strptime(dataset_obj.queryEndDate, dataset_obj.dateFormat).date()
    query_start_date = datetime.strptime(dataset_obj.queryStartDate, dataset_obj.dateFormat).date()
    dataset_obj.dateDifference = (query_end_date - query_start_date).total_seconds() / 60
    return dataset_obj


def extract_dates_from_graphql_query(dataset_obj: Dataset = None, new_start_date=None, new_end_date=None):
    # Parse the GraphQL query string into an AST (Abstract Syntax Tree)
    ast = parse(dataset_obj.newQuery)

    # Initialize variables to store startDate and endDate
    start_date = None
    end_date = None

    # Traverse through the AST to find the startDate and endDate arguments
    for definition in ast.definitions:
        for selection in definition.selection_set.selections:
            for field in selection.selection_set.selections:
                if field.name.value == dataset_obj.selectedFieldName:
                    for arg in field.arguments:
                        if arg.name.value == dataset_obj.dataKeysStart:
                            if new_start_date is not None:
                                arg.value.value = new_start_date
                            start_date = arg.value.value
                        elif arg.name.value == dataset_obj.dataKeysEnd:
                            if new_end_date is not None:
                                arg.value.value = new_end_date
                            end_date = arg.value.value

    ast_string = print_ast(ast)

    dataset_obj.newQuery = ast_string
    dataset_obj.queryStartDate = start_date
    dataset_obj.queryEndDate = end_date
    return dataset_obj


def extract_dataset_name(query_string):
    ast = parse(query_string)
    for definition in ast.definitions:
        for selection in definition.selection_set.selections:
            return selection.name.value
    return None


def read_json_file(filename):
    file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)
    try:
        with open(file_path, 'r') as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"Error: File '{filename}' not found in the directory.")
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON file '{filename}': {e}")
    return None
