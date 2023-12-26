using Amazon.SecretsManager;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace spApiCsharpApp
{
    public class GetDFOrdersOutput
    {            
        public List<DFOrder> dfOrdersList { get; set; }     

    }
   
}
