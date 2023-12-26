using Amazon.SecretsManager;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace spApiCsharpApp
{
    public class DFOrderItems
    {
        public String itemSequenceNumber { get; set; }
        public String buyerProductIdentifier { get; set; }
        public String vendorProductIdentifier { get; set; }
        public int quantity { get; set; }        

    }
   
}
