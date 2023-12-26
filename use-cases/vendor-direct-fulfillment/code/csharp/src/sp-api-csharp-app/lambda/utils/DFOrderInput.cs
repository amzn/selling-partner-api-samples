using Amazon.SecretsManager;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace spApiCsharpApp
{
    public class DFOrderInput
    {
        public String regionCode { get; set; }                 
        public String confirmShipment { get; set; }         
        public String limit {  get; set; }
        public DFOrder dfOrder { get; set; }       

    }
   
}
